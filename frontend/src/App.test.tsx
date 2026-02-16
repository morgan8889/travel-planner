import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("Travel Planner")).toBeInTheDocument();
  });

  it("renders the welcome message", () => {
    render(<App />);
    expect(screen.getByText("Welcome to Travel Planner")).toBeInTheDocument();
  });
});
