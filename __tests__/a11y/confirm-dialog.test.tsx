/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import jestAxe from "jest-axe";
const { axe, toHaveNoViolations } = jestAxe;
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";

expect.extend(toHaveNoViolations);

test("ConfirmDialog (open) has no accessibility violations", async () => {
  const { container } = render(
    <ConfirmDialog
      open={true}
      onOpenChange={() => {}}
      title="Delete item?"
      description="This action cannot be undone."
      onConfirm={() => {}}
    />
  );
  expect(await axe(container)).toHaveNoViolations();
});

test("ConfirmDialog with destructive variant has no accessibility violations", async () => {
  const { container } = render(
    <ConfirmDialog
      open={true}
      onOpenChange={() => {}}
      title="Remove permanently?"
      description="All data associated with this item will be deleted."
      confirmLabel="Delete"
      cancelLabel="Keep"
      variant="destructive"
      onConfirm={() => {}}
    />
  );
  expect(await axe(container)).toHaveNoViolations();
});
