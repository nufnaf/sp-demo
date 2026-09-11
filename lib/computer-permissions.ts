export type ComputerPermission = "accessibility" | "screenRecording";
export type ComputerPermissions = {
  supported: boolean;
  accessibility: boolean;
  screenRecording: boolean;
  captureVerified?: boolean;
  initializationComplete?: boolean;
};
