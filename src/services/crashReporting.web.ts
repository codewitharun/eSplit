// Web twin of crashReporting.ts - Crashlytics/Analytics are native-only here.
export async function identifyUser(_uid: string | null): Promise<void> {}
export function recordError(error: unknown, context?: string): void {
  console.error('[web] recordError', context ?? '', error);
}
export function trackScreenView(_screenName: string): void {}
