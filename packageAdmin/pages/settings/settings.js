const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    darkMode: false,
    loading: true,
    settings: {
      announcement: ''  // 公告内容
    }
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    })
    
    // 设置导航栏颜色
    this.updateNavigationBarColor();
    
    this.loadAnnouncement()
  },

  onShow() {
    // 检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }
  },

  // 更新导航栏颜色
  updateNavigationBarColor() {
    wx.setNavigationBarColor({
      frontColor: this.data.darkMode ? '#ffffff' : '#000000',
      backgroundColor: this.data.darkMode ? '#1f1f1f' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });
  },

  onPullDownRefresh() {
    this.loadAnnouncement().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadAnnouncement() {
    try {
      this.setData({ loading: true })
      // 获取最新的公告
      const { data } = await db.collection('announcements')
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
      
      if (data && data.length > 0) {
        this.setData({
          settings: {
            announcement: data[0].content || ''
          }
        })
      }
    } catch (error) {
      console.error('加载公告失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleInput(e) {
    const value = e.detail.value
    this.setData({
      'settings.announcement': value
    })
  },

  async saveSettings() {
    if (!this.data.settings.announcement.trim()) {
      wx.showToast({
        title: '公告内容不能为空',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      // 添加新公告
      await db.collection('announcements').add({
        data: {
          content: this.data.settings.announcement.trim(),
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

    } catch (error) {
      console.error('保存公告失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  }
}) 