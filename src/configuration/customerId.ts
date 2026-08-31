import * as vscode from 'vscode';
import fireAndForget from '../lib/fireAndForget';

// Managed entitlement for locked-down deployments. A customer ID switches the extension
// into its authenticated state without contacting getappmap.com; it is set by administrators
// through the organization-configuration channels (bundled VSIX, config URL, local file).
//
// It is deliberately unverified. The extension is open source, so a client-side check is a
// business-process boundary, not a security boundary. This must never be described as an
// enforcement mechanism. It is also not a secret; see doc/organization-config.md.
//
// Entitlement is a separate axis from credentials: a customer ID never masquerades as an
// API key, and getApiKey() keeps returning only real session tokens.

// globalState rather than SecretStorage: the value is not a secret, and SecretStorage depends
// on an OS keyring that is absent or broken in headless-Linux, container, and remote setups —
// a silent get() failure there would de-entitle users unpredictably. Not registered for
// Settings Sync, so it cannot ride onto personal machines.
const STATE_KEY = 'appmap.customerId';

const CONFIG_SECTION = 'appMap';
const CONFIG_KEY = 'customerId';

export type CustomerIdSource = 'bundled' | 'orgConfig';

export interface CustomerIdState {
  value: string;
  source: CustomerIdSource;
}

// Blank or whitespace-only values are treated as absent throughout.
function normalize(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Unrecognized shapes read as absent, so a corrupt entry self-heals by re-seeding.
function readState(context: vscode.ExtensionContext): CustomerIdState | undefined {
  const raw = context.globalState.get<unknown>(STATE_KEY);
  if (!raw || typeof raw !== 'object') return undefined;

  const { value, source } = raw as Partial<CustomerIdState>;
  if (source !== 'bundled' && source !== 'orgConfig') return undefined;

  const normalized = normalize(value);
  if (!normalized) return undefined;

  return { value: normalized, source };
}

function writeState(
  context: vscode.ExtensionContext,
  state: CustomerIdState | undefined
): Thenable<void> {
  return context.globalState.update(STATE_KEY, state);
}

/**
 * The customer ID baked into a repackaged VSIX, if any.
 *
 * Only the setting's *default* is consulted. `appMap.customerId` is declared in no repo
 * package.json — build/bundleConfig.ps1 synthesizes the property from site-config.json — so
 * the default exists only inside a bundled build. Unregistered keys are still readable through
 * get(), so reading anything but `defaultValue` would let a hand-written settings.json entry
 * entitle any build.
 */
export function bundledCustomerId(): string | undefined {
  return normalize(
    vscode.workspace.getConfiguration(CONFIG_SECTION).inspect<string>(CONFIG_KEY)?.defaultValue
  );
}

/** The customer ID and where it came from, or undefined when not entitled. */
export function getCustomerIdState(context: vscode.ExtensionContext): CustomerIdState | undefined {
  return readState(context);
}

/** The single read path for entitlement. No other caller consults getConfiguration(). */
export function getCustomerId(context: vscode.ExtensionContext): string | undefined {
  return readState(context)?.value;
}

export function isEntitled(context: vscode.ExtensionContext): boolean {
  return getCustomerId(context) !== undefined;
}

const entitlementChanged = new vscode.EventEmitter<string | undefined>();

/**
 * Fires when the effective customer ID changes, with the new value.
 *
 * globalState.update() announces nothing, so without this every consumer of entitlement would
 * hold stale state until the window reloaded. It fires from the mutators rather than from their
 * callers so that no future writer can forget to, and only on an effective change: clearing on a
 * bundled build reseeds to the same ID, and reporting that as a transition would restart the
 * language services for nothing.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const onDidChangeEntitlement: vscode.Event<string | undefined> = entitlementChanged.event;

/**
 * Project the bundled default onto globalState. Run once per activation, before anything
 * consults entitlement.
 *
 * globalState is a projection, not an independent source of truth, but organization config
 * wins over the bundled default: an `orgConfig` value is left alone in every case, while a
 * `bundled` value tracks the default it came from — re-seeding when a VSIX upgrade changes it,
 * and clearing when a vanilla build is installed over a bundled one.
 */
export async function seedCustomerId(context: vscode.ExtensionContext): Promise<void> {
  const state = readState(context);
  if (state?.source === 'orgConfig') return;

  const bundled = bundledCustomerId();

  if (state?.source === 'bundled') {
    if (!bundled) await writeState(context, undefined);
    else if (state.value !== bundled)
      await writeState(context, { value: bundled, source: 'bundled' });
    return;
  }

  if (bundled) await writeState(context, { value: bundled, source: 'bundled' });
  else if (context.globalState.get(STATE_KEY) !== undefined) await writeState(context, undefined);
}

/**
 * Record a customer ID. Internal: the value is only ever written by seeding and by
 * organization-config apply, never by a user-facing command.
 *
 * Returns the resulting customer ID, which for a blank value is whatever re-seeding leaves
 * behind rather than nothing.
 */
export async function setCustomerId(
  context: vscode.ExtensionContext,
  value: string,
  source: CustomerIdSource
): Promise<string | undefined> {
  const normalized = normalize(value);
  if (!normalized) return clearCustomerId(context);

  const current = readState(context);
  if (current?.value !== normalized || current.source !== source) {
    await writeState(context, { value: normalized, source });
  }
  if (current?.value !== normalized) entitlementChanged.fire(normalized);

  return normalized;
}

// The scopes a user can define the setting in, paired with the target that clears each.
const OVERRIDE_SCOPES = [
  ['globalValue', vscode.ConfigurationTarget.Global],
  ['workspaceValue', vscode.ConfigurationTarget.Workspace],
  ['workspaceFolderValue', vscode.ConfigurationTarget.WorkspaceFolder],
] as const;

type Inspection = ReturnType<vscode.WorkspaceConfiguration['inspect']>;

function definedOverrides(inspection: Inspection): vscode.ConfigurationTarget[] {
  if (!inspection) return [];
  return OVERRIDE_SCOPES.filter(([scope]) => inspection[scope] !== undefined).map(
    ([, target]) => target
  );
}

/**
 * Warn a user who sets `appMap.customerId` by hand that it does nothing.
 *
 * Only the setting's default is ever read, so an override is inert in every build. That is
 * worth saying on a bundled build, where the key is a registered setting and the organization
 * controls it anyway. In a public build the key is unregistered and this stays silent: a
 * notification explaining that the setting has no effect would advertise the feature to
 * precisely the one user poking at it.
 *
 * Warns at most once per registration, since editing settings.json fires several change
 * events in a row.
 */
export function registerCustomerIdOverrideWarning(): vscode.Disposable {
  let warned = false;

  async function warnAboutOverride(): Promise<void> {
    if (warned) return;

    const inspection = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .inspect<string>(CONFIG_KEY);
    if (inspection?.defaultValue === undefined) return;

    const targets = definedOverrides(inspection);
    if (targets.length === 0) return;

    // Set before awaiting, so a burst of change events cannot queue a second notification.
    warned = true;

    const removeSetting = 'Remove setting';
    const choice = await vscode.window.showWarningMessage(
      `The appMap.customerId setting has no effect — the customer ID for this installation is managed by your organization's configuration. Your value is being ignored.`,
      removeSetting
    );
    if (choice !== removeSetting) return;

    // Rewriting settings.json is offered rather than assumed, and a user can have the key
    // defined in more than one scope.
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    for (const target of targets) await config.update(CONFIG_KEY, undefined, target);
  }

  // An override that predates this window is just as inert as one typed into it, and the
  // change event never fires for it. Not awaited: activation must not block on a notification.
  fireAndForget(warnAboutOverride);

  return vscode.workspace.onDidChangeConfiguration((e) => {
    // Deliberately narrow: appmapServerConfiguration.ts watches all of `appMap`, which would
    // run this on every unrelated settings edit.
    if (e.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_KEY}`))
      return fireAndForget(warnAboutOverride);
  });
}

/**
 * Clear the customer ID, then re-seed synchronously so that a bundled build reconverges on its
 * own ID immediately. There is no tombstone: callers can report the value the user is actually
 * left with rather than one that reappears on the next reload.
 *
 * Returns the customer ID in effect afterwards, or undefined when clearing took full effect.
 */
export async function clearCustomerId(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const before = getCustomerId(context);

  await writeState(context, undefined);
  await seedCustomerId(context);

  const after = getCustomerId(context);
  if (before !== after) entitlementChanged.fire(after);

  return after;
}
