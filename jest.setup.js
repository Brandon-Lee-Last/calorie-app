// Reanimated and Worklets run on the UI thread, which tests do not have; use their official mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Health Connect is Android's native health store; tests get a phone where it is installed but not yet connected.
// A test can change what it answers with jest.mocked(require('react-native-health-connect').<fn>).
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  getSdkStatus: jest.fn(async () => 3),
  initialize: jest.fn(async () => true),
  getGrantedPermissions: jest.fn(async () => []),
  requestPermission: jest.fn(async () => []),
  aggregateRecord: jest.fn(async () => ({ COUNT_TOTAL: 0, dataOrigins: [] })),
  openHealthConnectSettings: jest.fn(),
}));
