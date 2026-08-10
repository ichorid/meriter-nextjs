"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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

function roundToStep(value: number, step: number): number {
  const factor = 1 / step;
  return Math.round(value * factor) / factor;
}

function parseAmountInput(raw: string, step: number): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (normalized === "") return null;
  if (!/^\d*\.?\d{0,1}$/.test(normalized)) return null;
  const num = Number.parseFloat(normalized);
  if (Number.isNaN(num)) return null;
  return roundToStep(num, step);
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
    const t = useTranslations("common.ariaLabels");
    const [inputValue, setInputValue] = React.useState(value.toString());

    React.useEffect(() => {
      setInputValue(value.toString());
    }, [value]);

    const clampedValue = Math.max(min, Math.min(max, roundToStep(value, step)));
    const displayValue = value === 0 && inputValue === "" ? "" : inputValue;

    const commitAmount = (num: number) => {
      const next = Math.max(min, Math.min(max, roundToStep(num, step)));
      setInputValue(next.toString());
      onChange(next);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(",", ".");
      if (raw === "") {
        setInputValue("");
        onChange(min);
        return;
      }
      if (!/^\d*\.?\d{0,1}$/.test(raw)) {
        return;
      }
      setInputValue(raw);
      if (raw.endsWith(".")) {
        return;
      }
      const parsed = parseAmountInput(raw, step);
      if (parsed != null) {
        const next = Math.max(min, Math.min(max, roundToStep(parsed, step)));
        onChange(next);
      }
    };

    const handleBlur = () => {
      const parsed = parseAmountInput(inputValue, step);
      if (parsed == null) {
        setInputValue(clampedValue.toString());
        onChange(clampedValue);
        return;
      }
      commitAmount(parsed);
    };

    const handleDecrease = () => {
      commitAmount(value - step);
    };

    const handleIncrease = () => {
      commitAmount(value + step);
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
          aria-label={t("decrease")}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
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
          aria-label={t("increase")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    );
  }
);
AmountStepper.displayName = "AmountStepper";
