import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return <pre style={{ padding: 24, whiteSpace: "pre-wrap", color: "#b3372f" }}>
        Something broke in the UI:{"\n"}{String(this.state.error?.stack || this.state.error)}
      </pre>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<Boundary><App /></Boundary>);