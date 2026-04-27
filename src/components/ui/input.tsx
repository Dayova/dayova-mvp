import * as React from "react";
import { Platform, TextInput } from "react-native";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type InputRef = React.ElementRef<typeof TextInput>;
type InputProps = React.ComponentProps<typeof TextInput> & {
  ref?: React.Ref<InputRef>;
};

function Input({
  className,
  placeholderTextColor,
  selectionColor,
  style,
  ref,
  ...props
}: InputProps) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        "flex-1 font-poppins text-16 text-text",
        Platform.select({
          web: "outline-none",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      style={[
        {
          margin: 0,
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 0,
          fontSize: DAYOVA_DESIGN_SYSTEM.typography.field.placeholder.fontSize,
          lineHeight: DAYOVA_DESIGN_SYSTEM.typography.field.placeholder.lineHeight,
          letterSpacing: 0,
          ...Platform.select({
            android: {
              includeFontPadding: false,
              textAlignVertical: "center" as const,
            },
          }),
        },
        style,
      ]}
      placeholderTextColor={
        placeholderTextColor ?? `${DAYOVA_DESIGN_SYSTEM.colors.text}5C`
      }
      selectionColor={selectionColor ?? DAYOVA_DESIGN_SYSTEM.colors.primary}
      {...props}
    />
  );
}

export { Input };
