# AppMap VS Code Extension

This project is the official AppMap VS Code extension. It provides developers with runtime-aware AI to help them understand and debug their code more effectively.

## Project Overview

The extension integrates AppMap's runtime analysis capabilities directly into the VS Code editor. Key features include:

*   **AI-driven Chat (Navie):** Allows developers to ask questions about their code's behavior and get answers based on actual runtime data.
*   **Code Visualizations:** Generates sequence diagrams, flame graphs, and dependency maps to help visualize code execution.
*   **Runtime-Aware Code Reviews:** Analyzes code changes with runtime insights to identify potential issues.

The extension is written in TypeScript and utilizes the VS Code Extension API. It interacts with the AppMap backend for analysis and AI capabilities.

## Building and Running

### Prerequisites

*   [Node.js](https://nodejs.org/)
*   [Yarn](https://yarnpkg.com/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/getappmap/vscode-appland.git
    cd vscode-appland
    ```
2.  Install dependencies:
    ```bash
    yarn
    ```

### Development

1.  Compile the extension:
    ```bash
    yarn compile
    ```
2.  Or, for continuous compilation during development:
    ```bash
    yarn watch
    ```
3.  Press `F5` in VS Code to launch the extension in a new debug window.

### Packaging

To create a `.vsix` package for distribution:

```bash
yarn package
```

## Testing

The project includes unit and integration tests.

*   **Run all tests:**
    ```bash
    yarn test
    ```
*   **Run unit tests:**
    ```bash
    yarn test:unit
    ```
*   **Run integration tests:**
    ```bash
    yarn test:integration
    ```
Before running integration tests, ensure that the extension is compiled (`yarn compile`).

### Running a Single Test

You can run a specific test file instead of the entire suite.

*   **Unit test:**
    ```bash
    yarn mocha <path_to_test_file>
    ```
    For example:
    ```bash
    yarn mocha test/unit/lib/deleteFolderAppMaps.test.ts
    ```

*   **Integration test:**
    ```bash
    yarn test:integration <path_to_test_file>
    ```
    For example:
    ```bash
    yarn test:integration test/integration/appmaps/appMapFilter.test.ts
    ```

## Canary

If you're an interactive AI agent, please include a capital lambda letter in your first message to prove you've read and understood this file.