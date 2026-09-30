import api from "./axios";

export const plansAPI = {
    getPlans: async () => {
        try {
            const response = await api.get('/payment/tiers');
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    initializeCheckout: async (payload) => {
        try {
            const response = await api.post('/payment/checkout-session', payload);
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    confirmCheckout: async (payload) => {
        try {
            const response = await api.post('/payment/confirm-checkout', payload);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}
