import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";

type Props = { children: ReactNode };
type State = { err: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("UI error", err, info);
  }

  render() {
    if (this.state.err) {
      return (
        <Box sx={{ p: 3, maxWidth: 560, mx: "auto", mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              שגיאה בטעינת המסך
            </Typography>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {this.state.err.message}
            </Typography>
            {import.meta.env.DEV && this.state.err.stack ? (
              <Typography
                variant="caption"
                component="pre"
                sx={{ whiteSpace: "pre-wrap", mt: 1, opacity: 0.85, fontSize: "0.7rem" }}
              >
                {this.state.err.stack}
              </Typography>
            ) : null}
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            רענן דף
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
