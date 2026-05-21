import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      expand={false}
      richColors
      closeButton
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:text-sm group-[.toaster]:font-medium",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-xs group-[.toast]:opacity-80 group-[.toast]:mt-0.5",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:bg-emerald-950 group-[.toaster]:border-emerald-700/60 group-[.toaster]:text-emerald-100",
          error:
            "group-[.toaster]:bg-red-950 group-[.toaster]:border-red-700/60 group-[.toaster]:text-red-100",
          warning:
            "group-[.toaster]:bg-amber-950 group-[.toaster]:border-amber-600/60 group-[.toaster]:text-amber-100",
          info:
            "group-[.toaster]:bg-sky-950 group-[.toaster]:border-sky-700/60 group-[.toaster]:text-sky-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
