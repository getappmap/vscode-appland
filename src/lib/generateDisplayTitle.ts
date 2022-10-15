import { ResolvedFinding } from '../services/resolvedFinding';

// Gets's name displayed in Findings bar
export default (finding: ResolvedFinding): string => {
  const {
    finding: { ruleTitle },
    groupDetails,
    locationLabel,
  } = finding;

  const ruleAndContext = groupDetails ? `${ruleTitle}: ${groupDetails}` : ruleTitle;

  // Only display problemLocation if it exists
  const fullPathString = locationLabel ? `, ${locationLabel}` : '';

  return `${ruleAndContext}${fullPathString}`;
};
