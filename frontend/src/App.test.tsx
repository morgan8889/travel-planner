import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { supabase } from './lib/supabase';

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
      signInWithOtp: vi.fn(),
    },
  },
}))

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    } as any);
  });

  it("renders loading state initially", () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);

    render(<App />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders auth form when no session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);

    render(<App />);

    // Wait for loading to complete
    await screen.findByText("Welcome to Travel Planner");
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send magic link/i })).toBeInTheDocument();
  });

  it("renders main content when authenticated", async () => {
    const mockSession = {
      user: { email: "test@example.com" },
      access_token: "mock-token",
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: mockSession } } as any);

    render(<App />);

    // Wait for loading to complete
    await screen.findByText("Travel Planner");
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText("Welcome to Travel Planner")).toBeInTheDocument();
  });
});
