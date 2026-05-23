import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

function InputOTP({
  className,
  containerClassName,
  ref,
  ...props
}: React.ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}
InputOTP.displayName = "InputOTP";

// react-doctor-disable-next-line react-doctor/no-multi-comp
function InputOTPGroup({ className, ref, ...props }: React.ComponentProps<"div">) {
  return <div ref={ref} className={cn("flex items-center", className)} {...props} />;
}
InputOTPGroup.displayName = "InputOTPGroup";

// react-doctor-disable-next-line react-doctor/no-multi-comp
function InputOTPSlot({
  index,
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const inputOTPContext = React.use(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex size-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}
InputOTPSlot.displayName = "InputOTPSlot";

// react-doctor-disable-next-line react-doctor/no-multi-comp
function InputOTPSeparator({ ref, ...props }: React.ComponentProps<"div">) {
  return (
    <div ref={ref} aria-hidden="true" {...props}>
      <Minus />
    </div>
  );
}
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
