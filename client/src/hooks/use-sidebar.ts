import { create } from "zustand";

type SidebarStore = {
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
	toggle: () => void;
};

export const useSidebar = create<SidebarStore>((set) => ({
	isOpen: true,
	setIsOpen: (isOpen) => set({ isOpen }),
	toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
