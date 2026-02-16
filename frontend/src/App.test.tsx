import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from '@supabase/supabase-js';
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

vi.mock('./lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          id: 'mock-subscription-id',
          unsubscribe: vi.fn(),
          callback: vi.fn()
        }
      }
    } as ReturnType<typeof supabase.auth.onAuthStateChange>);
  });

  it("renders loading state initially", () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });

    render(<App />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders auth form when no session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });

    render(<App />);

    // Wait for loading to complete
    await screen.findByText("Welcome to Travel Planner");
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send magic link/i })).toBeInTheDocument();
  });

  it("renders main layout when authenticated", async () => {
    const mockSession = {
      user: {
        id: 'test-id',
        email: "test@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
      },
      access_token: "mock-token",
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      refresh_token: 'mock-refresh-token'
    } as Session;

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    render(<App />);

    // Wait for loading to complete - the router renders the header with "Travel Planner"
    await screen.findByText("Travel Planner");
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
