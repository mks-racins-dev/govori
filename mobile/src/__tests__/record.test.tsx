import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n/ru';

import RecordScreen from '../app/record';

const mockRecorder = {
  prepareToRecordAsync: jest.fn(() => Promise.resolve()),
  record: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  uri: 'file:///speech.m4a',
};
const mockRecorderState = { durationMillis: 0, metering: -20, isRecording: true };

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => mockRecorderState,
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ topicId: '7', topicText: 'Тема' }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  api: { uploadAttempt: jest.fn(() => Promise.resolve({ id: 42 })) },
  ApiError: class ApiError extends Error {},
}));

// Keep the visual components out of the way: the test only cares about behaviour.
jest.mock('@/components/countdown-ring', () => ({ CountdownRing: ({ children }: any) => children }));
jest.mock('@/components/waveform', () => ({ Waveform: () => null, dbToLevel: () => 0.5 }));
jest.mock('@/components/ui', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    Screen: ({ children, footer }: any) => (
      <View>
        {children}
        {footer}
      </View>
    ),
    Centered: ({ children }: any) => <View>{children}</View>,
    Muted: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ label, onPress, disabled }: any) => (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

const { api } = jest.requireMock('@/lib/api');
const { router } = jest.requireMock('expo-router');

async function renderRecording() {
  const view = await render(<RecordScreen />);
  await waitFor(() => expect(mockRecorder.record).toHaveBeenCalled());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderState.durationMillis = 0;
});

it('shows the discard button while recording', async () => {
  await renderRecording();
  expect(screen.getByText(t.record.discard)).toBeTruthy();
});

it('discarding stops the recorder, goes home and never uploads', async () => {
  await renderRecording();

  await act(async () => {
    await fireEvent.press(screen.getByText(t.record.discard));
  });

  expect(mockRecorder.stop).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(api.uploadAttempt).not.toHaveBeenCalled();
});

it('discarding works before the 15-second minimum', async () => {
  mockRecorderState.durationMillis = 2000;
  await renderRecording();

  await act(async () => {
    await fireEvent.press(screen.getByText(t.record.discard));
  });

  expect(router.replace).toHaveBeenCalledWith('/');
  expect(api.uploadAttempt).not.toHaveBeenCalled();
});

it('hitting the time limit after discarding does not upload', async () => {
  const view = await renderRecording();

  await act(async () => {
    await fireEvent.press(screen.getByText(t.record.discard));
  });
  mockRecorderState.durationMillis = 61_000;
  await act(async () => {
    await view.rerender(<RecordScreen />);
  });

  expect(api.uploadAttempt).not.toHaveBeenCalled();
});

it('disables discard while finishing at the time limit', async () => {
  mockRecorderState.durationMillis = 59_900;
  const view = await renderRecording();
  let resolveStop!: () => void;
  mockRecorder.stop.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveStop = resolve;
      }),
  );
  mockRecorderState.durationMillis = 60_000;
  await act(async () => {
    await view.rerender(<RecordScreen />);
  });

  expect(screen.getByRole('button', { name: t.record.discard }).props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    await fireEvent.press(screen.getByText(t.record.discard));
  });
  expect(api.uploadAttempt).not.toHaveBeenCalled();

  await act(async () => {
    resolveStop();
  });
  await waitFor(() => expect(api.uploadAttempt).toHaveBeenCalledWith(7, 60, 'file:///speech.m4a'));
});

it('finishing normally still uploads (control case)', async () => {
  mockRecorderState.durationMillis = 20_000;
  const view = await renderRecording();
  // Accumulate voiced time so the silence check passes.
  mockRecorderState.durationMillis = 30_000;
  await act(async () => {
    await view.rerender(<RecordScreen />);
  });

  await act(async () => {
    await fireEvent.press(screen.getByText(t.record.stop));
  });

  await waitFor(() => expect(api.uploadAttempt).toHaveBeenCalledWith(7, 30, 'file:///speech.m4a'));
});
