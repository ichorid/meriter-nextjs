"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";

export interface AmountStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Number input with minus/plus buttons (like in VotingPanel).
 * Use instead of plain type="number" for amount fields.
 */
export const AmountStepper = React.forwardRef<HTMLInputElement, AmountStepperProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = Infinity,
      step = 1,
      disabled = false,
      placeholder = "0",
      id,
      className,
      inputClassName,
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState(value.toString());

    React.useEffect(() => {
      setInputValue(value.toString());
    }, [value]);

    const clampedValue = Math.max(min, Math.min(max, value));
    const displayValue = value === 0 && inputValue === "" ? "" : inputValue;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digitsOnly = raw.replace(/\D/g, "");
      if (digitsOnly === "") {
        setInputValue("");
        onChange(min);
        return;
      }
      const num = parseInt(digitsOnly, 10);
      if (!Number.isNaN(num)) {
        const next = Math.max(min, Math.min(max, num));
        setInputValue(next.toString());
        onChange(next);
      }
    };

    const handleBlur = () => {
      setInputValue(clampedValue.toString());
      onChange(clampedValue);
    };

    const handleDecrease = () => {
      const next = Math.max(min, value - step);
      setInputValue(next.toString());
      onChange(next);
    };

    const handleIncrease = () => {
      const next = Math.min(max, value + step);
      setInputValue(next.toString());
      onChange(next);
    };

    const canDecrease = value > min && !disabled;
    const canIncrease = value < max && !disabled;

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          onClick={handleDecrease}
          disabled={!canDecrease}
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label="Decrease"
        >
          <Minus className="h-5 w-5" />
        </Button>
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-12 text-center text-lg font-semibold",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]",
            inputClassName
          )}
        />
        <Button
          type="button"
          onClick={handleIncrease}
          disabled={!canIncrease}
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label="Increase"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    );
  }
);
AmountStepper.displayName = "AmountStepper";
