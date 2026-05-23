import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LimitBar } from "@/routes/_app/dashboard/LimitBar";

describe("LimitBar", () => {
  it("shows 'Unlimited' when limit is -1", () => {
    render(<LimitBar used={50} limit={-1} />);
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("shows correct remaining count", () => {
    render(<LimitBar used={3} limit={10} />);
    expect(screen.getByText("7 left of 10")).toBeInTheDocument();
  });

  it("shows 0 left when used exceeds limit", () => {
    render(<LimitBar used={15} limit={10} />);
    expect(screen.getByText("0 left of 10")).toBeInTheDocument();
  });

  it("applies danger class when usage >= 80%", () => {
    const { container } = render(<LimitBar used={8} limit={10} />); // 80%
    const label = container.querySelector(".text-destructive");
    expect(label).toBeInTheDocument();
  });

  it("does not apply danger class when usage < 80%", () => {
    const { container } = render(<LimitBar used={5} limit={10} />); // 50%
    const label = container.querySelector(".text-destructive");
    expect(label).not.toBeInTheDocument();
  });

  it("clamps bar to 100% when over-used", () => {
    const { container } = render(<LimitBar used={20} limit={10} />);
    const bar = container.querySelector(".w-full");
    expect(bar).toBeInTheDocument();
  });
});
