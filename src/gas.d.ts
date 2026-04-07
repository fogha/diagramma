/**
 * Ambient declarations for the google.script.run API available
 * inside Google Apps Script HTML Service dialogs/sidebars.
 */
declare namespace google {
  namespace script {
    interface RunnerWithCallbacks {
      withSuccessHandler(handler: (result: unknown) => void): RunnerWithCallbacks;
      withFailureHandler(handler: (error: Error) => void): RunnerWithCallbacks;
      updateDiagramBlock(code: string, syntax: string, blockIndex: number): void;
      replaceDiagramWithImage(
        base64Png: string,
        meta: string,
        blockIndex: number,
      ): void;
      closeSidebar(): void;
    }

    const run: RunnerWithCallbacks & {
      updateDiagramBlock(code: string, syntax: string, blockIndex: number): void;
      replaceDiagramWithImage(
        base64Png: string,
        meta: string,
        blockIndex: number,
      ): void;
      closeSidebar(): void;
    };

    function close(): void;
  }
}
