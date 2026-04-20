import * as React from "react";
import { Platform, TextInput } from "react-native";
import { cn } from "~/lib/utils";

type InputProps = React.ComponentProps<typeof TextInput>;

function Input({ className, placeholderTextColor, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        "h-14 rounded-input border border-input bg-background px-5 font-poppins text-16 text-foreground",
        Platform.select({
          web: "outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      placeholderTextColor={placeholderTextColor ?? "rgba(26,26,26,0.48)"}
      {...props}
    />
  );
}

export { Input };
