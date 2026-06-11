import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders image settings including edge fade", () => {
  render(<App />);
  expect(screen.getByText("スタンプ設定")).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", {
      name: "黒余白との境界をグラデーションでぼかす",
    })
  ).toBeChecked();
});
