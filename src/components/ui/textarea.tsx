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
        "min-h-[112px] w-full flex-1 self-stretch font-poppins text-14 text-text",
        Platform.select({
          web: "outline-none",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      style={[
        {
          margin: 0,
          paddingTop: Platform.OS === "ios" ? 2 : 0,
          paddingBottom: 2,
          paddingHorizontal: 0,
          lineHeight: 22,
          letterSpacing: 0,
          verticalAlign: "top",
        },
        style,
      ]}
      underlineColorAndroid="transparent"
      placeholderTextColor={
        placeholderTextColor ?? `${DAYOVA_DESIGN_SYSTEM.colors.text}5C`
      }
      selectionColor={selectionColor ?? DAYOVA_DESIGN_SYSTEM.colors.primary}
      {...props}
    />
  );
}

export { Textarea };
