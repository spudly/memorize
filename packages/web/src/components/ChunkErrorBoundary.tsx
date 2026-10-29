import { Component, type ReactNode } from "react";
import { Alert, Button } from "@spudly/ui";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Recovery boundary for the lazily loaded surfaces (memorize#54).
 * Suspense covers a pending chunk; a *rejected* chunk import (e.g. the
 * old chunk 404s after a new deploy) propagates here instead of
 * unmounting the whole app. React caches the rejected lazy result, so
 * remounting cannot retry it — a full reload is the reliable recovery.
 * App keys this boundary by the active surface, so switching tabs clears
 * the error state and the other surfaces stay usable.
 */
export default class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <>
          <Alert severity="error">This section failed to load.</Alert>
          <Button onPress={() => window.location.reload()}>Reload the app</Button>
        </>
      );
    }
    return this.props.children;
  }
}
