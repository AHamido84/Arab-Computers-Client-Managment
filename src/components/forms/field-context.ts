"use client";

import { createContext, useContext } from "react";

/**
 * Set by <FormField> when its label isn't linked with htmlFor/id. Controls
 * (Select, Input, Textarea) use it to get an accessible name from the
 * visible label and a description from the hint/error text.
 */
export const FieldLabelContext = createContext<{ labelId: string; describedBy?: string } | null>(null);

type A11yProps = { id?: string; "aria-label"?: string; "aria-labelledby"?: string; "aria-describedby"?: string };

export function useFieldA11y(props: A11yProps): A11yProps {
  const ctx = useContext(FieldLabelContext);
  if (!ctx) return {};
  const named = props.id || props["aria-label"] || props["aria-labelledby"];
  return {
    ...(named ? {} : { "aria-labelledby": ctx.labelId }),
    ...(props["aria-describedby"] || !ctx.describedBy ? {} : { "aria-describedby": ctx.describedBy }),
  };
}
