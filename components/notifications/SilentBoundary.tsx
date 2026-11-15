import { Component, type ReactNode } from "react";

/** Long enough for a backend deploy to finish, short enough that a session gets its notifications back. */
const RETRY_AFTER_MS = 30 * 1000;

/**
 * Notifications are an extra. If one of their queries fails (the shared backend is mid-deploy,
 * a function is briefly missing) the failure stops here and this part of the app renders
 * nothing, instead of reaching the screen's error boundary and replacing the app with
 * "Couldn't reach Lineup". It mounts its children afresh after a pause.
 */
export class SilentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private retry: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.retry = setTimeout(() => this.setState({ failed: false }), RETRY_AFTER_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.retry);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
