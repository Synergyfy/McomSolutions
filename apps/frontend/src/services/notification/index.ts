import { apiClient } from '../api';

export const notificationApi = {
  getNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  markAllNotificationsRead: async () => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },

  deleteNotification: async (id: string) => {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  },
};
