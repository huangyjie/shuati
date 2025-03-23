const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    isAdmin: false,
    darkMode: false
  },

  onLoad: function() {
    if (!app.globalData) {
      app.globalData = {}
    }
    
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    })
    
    // 设置导航栏颜色
    this.updateNavigationBarColor();
    
    wx.nextTick(() => {
      this.checkAdminPermission()
    })
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

  async checkAdminPermission() {
    try {
      if (!app.globalData.userInfo || !app.globalData.userInfo.phoneNumber) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }

      if (app.globalData.userInfo.phoneNumber !== '输入你的手机号') {  // 仅允许特定用户访问
        wx.showToast({
          title: '无访问权限',
          icon: 'error'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }
      
      this.setData({ isAdmin: true })
    } catch (error) {
      console.error('权限检查失败：', error)
      wx.showToast({
        title: '系统错误',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 导航到不同的管理页面
  navigateTo(e) {
    const page = e.currentTarget.dataset.page
    const pageConfig = {
      statistics: {
        url: '/packageAdmin/pages/statistics/statistics',
        title: '数据统计'
      },
      users: {
        url: '/packageAdmin/pages/user-management/user-management',
        title: '用户管理'
      },
      developers: {
        url: '/packageAdmin/pages/developer-management/developer-management',
        title: '开发者管理'
      },
      qq_groups: {
        url: '/packageAdmin/pages/qq-groups-management/qq-groups-management',
        title: 'QQ群管理'
      },
      sponsors: {
        url: '/packageAdmin/pages/sponsor-management/sponsor-management',
        title: '赞助者管理'
      },
      resources: {
        url: '/packageAdmin/pages/resource-management/resource-management',
        title: '资源管理'
      },
      rewards: {
        url: '/packageAdmin/pages/reward-management/reward-management',
        title: '奖励发放'
      },
      settings: {
        url: '/packageAdmin/pages/settings/settings',
        title: '系统设置'
      },
      illegal_accounts: {
        url: '/packageAdmin/pages/illegal-accounts/illegal-accounts',
        title: '违规账号'
      },
      logs: {
        url: '/packageAdmin/pages/logs-management/logs-management',
        title: '日志管理'
      }
    }

    if (pageConfig[page]) {
      wx.navigateTo({
        url: pageConfig[page].url,
        success: () => {
          // 设置导航栏标题
          wx.setNavigationBarTitle({
            title: pageConfig[page].title
          })
        }
      })
    }
  }
}) 