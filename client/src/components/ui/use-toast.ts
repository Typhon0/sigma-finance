import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

type ToastOptions = {
	description?: ReactNode;
	action?: {
		label: string;
		onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	};
};

type ToastFunction = (
	message: ReactNode,
	options?: ToastOptions,
) => string | number;

interface Toast extends ToastFunction {
	success: ToastFunction;
	info: ToastFunction;
	warning: ToastFunction;
	error: ToastFunction;
}

const toast = ((message: ReactNode, options?: ToastOptions) =>
	sonnerToast(message, options)) as Toast;

toast.success = (message: ReactNode, options?: ToastOptions) =>
	sonnerToast.success(message, options);
toast.info = (message: ReactNode, options?: ToastOptions) =>
	sonnerToast.info(message, options);
toast.warning = (message: ReactNode, options?: ToastOptions) =>
	sonnerToast.warning(message, options);
toast.error = (message: ReactNode, options?: ToastOptions) =>
	sonnerToast.error(message, options);

export const useToast = () => {
	return { toast };
};
