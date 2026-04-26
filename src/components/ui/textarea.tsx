import * as React from "react";
import { Platform, TextInput } from "react-native";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type TextareaRef = React.ElementRef<typeof TextInput>;
type TextareaProps = React.ComponentProps<typeof TextInput> & {
  ref?: React.Ref<TextareaRef>;
};

function Textarea({
  className,
  placeholderTextColor,
  selectionColor,
  style,
  ref,
  ...props
}: TextareaProps) {
  return (
    <TextInput
      ref={ref}
      multiline
      textAlignVertical="top"
      className={cn(
        "min-h-[120px] flex-1 font-poppins text-16 text-text",
        Platform.select({
          web: "outline-none",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      style={[{ margin: 0, padding: 0, lineHeight: 24 }, style]}
      placeholderTextColor={
        placeholderTextColor ?? `${DAYOVA_DESIGN_SYSTEM.colors.text}5C`
      }
      selectionColor={selectionColor ?? DAYOVA_DESIGN_SYSTEM.colors.primary}
      {...props}
    />
  );
}

export { Textarea };
