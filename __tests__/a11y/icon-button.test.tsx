/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import jestAxe from "jest-axe";
const { axe, toHaveNoViolations } = jestAxe;
import { Search } from "lucide-react";
import { IconButton } from "@/components/primitives/IconButton";

expect.extend(toHaveNoViolations);

test("IconButton has no accessibility violations", async () => {
  const { container } = render(<IconButton icon={Search} label="Search" />);
  expect(await axe(container)).toHaveNoViolations();
});

test("IconButton with variant has no accessibility violations", async () => {
  const { container } = render(
    <IconButton icon={Search} label="Search items" variant="outline" />
  );
  expect(await axe(container)).toHaveNoViolations();
});
