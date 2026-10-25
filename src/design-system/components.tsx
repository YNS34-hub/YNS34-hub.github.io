import { forwardRef, type ComponentPropsWithoutRef } from "react";

export const MuseumTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<"h1">>(function MuseumTitle({ className = "", children, ...props }, ref) {
  return <h1 {...props} ref={ref} className={`museum-title ${className}`}>{children ?? <><span>The Memory</span><span>Palace</span></>}</h1>;
});
export const MuseumLabel = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<"p">>(function MuseumLabel({ className = "", ...props }, ref) {
  return <p {...props} ref={ref} className={`museum-label ${className}`} />;
});
export const GlassButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(function GlassButton({ className = "", type = "button", ...props }, ref) {
  return <button {...props} type={type} ref={ref} className={`museum-glass-button ${className}`} />;
});
export const MuseumNavigation = forwardRef<HTMLElement, ComponentPropsWithoutRef<"header"> & { "data-tone"?: "light" | "dark" }>(function MuseumNavigation({ className = "", ...props }, ref) {
  return <header {...props} ref={ref} className={`museum-navigation ${className}`} />;
});
// 只包装现有 DOM；Dialog 继续持有键盘、焦点陷阱与关闭状态，不另建弹窗系统。
export const MuseumPanel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function MuseumPanel({ className = "", ...props }, ref) {
  return <div {...props} ref={ref} className={`panel museum-panel ${className}`} />;
});
