// developers.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    darkMode: false,
    defaultAvatarUrl,
    developers: []
  },

  onLoad() {
    // 获取系统深色模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });

    if (darkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2d2d2d'
      });
    }

    this.loadDevelopers();
  },

  onShow() {
    // 页面显示时，同步深色模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  // 从云数据库加载开发者信息
  async loadDevelopers() {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      const db = wx.cloud.database();
      const { data } = await db.collection('developers')
        .orderBy('order', 'asc')
        .get();

      // 为每个开发者添加QQ头像URL
      const developers = data.map(dev => ({
        ...dev,
        avatar: `https://q1.qlogo.cn/g?b=qq&nk=${dev.qq}&s=640`
      }));

      this.setData({ developers });

      wx.hideLoading();
    } catch (err) {
      console.error('获取开发者列表失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  }
}); 