import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useMutation,
} from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useContext, useMemo } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DELETE_ACCOUNT } from "@/graphql/mutations/accounts";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";

export interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accountId: string;
	accountName: string;
	portfolioId?: string;
	onSuccess?: () => void;
}

export function DeleteAccountDialog({
	open,
	onOpenChange,
	accountId,
	accountName,
	portfolioId,
	onSuccess,
}: DeleteAccountDialogProps) {
	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);

	const [deleteAccount, { loading }] = useMutation(DELETE_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: portfolioId ? [{ query: GET_ACCOUNTS, variables: { portfolioId } }] : undefined,
		update(cache) {
			cache.evict({ id: cache.identify({ __typename: "Account", id: accountId }) });
			cache.gc();
		},
	});

	const handleDelete = async (e: React.MouseEvent) => {
		e.preventDefault();
		if (!accountId) return;

		const toastId = toast.loading("Deleting account...");
		try {
			const res = await deleteAccount({
				variables: { id: accountId },
			});

			if (res.data?.deleteAccount === false) {
				throw new Error("Failed to delete account");
			}

			toast.success(`Account "${accountName}" deleted successfully`, { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to delete account";
			toast.error(msg, { id: toastId });
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Account</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete{" "}
						<span className="font-semibold text-foreground">{accountName}</span>? All associated
						positions and holdings in this account will be permanently removed. This action cannot
						be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={loading}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{loading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Deleting...
							</>
						) : (
							"Delete Account"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
