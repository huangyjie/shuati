Page({
  data: {
    sponsors: [],
    loading: true
  },

  onLoad() {
    this.loadSponsors();
  },

  // 加载赞助者列表
  async loadSponsors() {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('sponsor')
        .orderBy('_createTime', 'asc')
        .get();

      this.setData({
        sponsors: data,
        loading: false
      });
    } catch (err) {
      console.error('获取赞助者列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        loading: false
      });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadSponsors();
    wx.stopPullDownRefresh();
  }
}); 