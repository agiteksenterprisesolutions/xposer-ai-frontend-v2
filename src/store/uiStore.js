// src/store/uiStore.js
import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  // Sidebar state
  sidebarOpen: true,
  mobileSidebarOpen: false,
  
  // Modal states
  activeModal: null,
  modalData: null,
  
  // Loading states
  loading: false,
  loadingMessage: '',
  
  // Notification
  notification: null,
  
  // Theme
  theme: 'light',
  
  // Toggle sidebar
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  // Toggle mobile sidebar
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  
  // Open modal
  openModal: (modalName, data = null) => set({ activeModal: modalName, modalData: data }),
  
  // Close modal
  closeModal: () => set({ activeModal: null, modalData: null }),
  
  // Set loading
  setLoading: (isLoading, message = '') => set({ loading: isLoading, loadingMessage: message }),
  
  // Show notification
  showNotification: (message, type = 'info', duration = 5000) => {
    set({ notification: { message, type, duration, id: Date.now() } });
    
    // Auto-clear notification
    if (duration > 0) {
      setTimeout(() => {
        if (get().notification?.id === Date.now()) {
          set({ notification: null });
        }
      }, duration);
    }
  },
  
  // Clear notification
  clearNotification: () => set({ notification: null }),
  
  // Toggle theme
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
  
  // Set theme
  setTheme: (theme) => set({ theme })
}));