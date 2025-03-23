Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    examPapers: [],
    darkMode: false,
    isLogin: false,
    loading: true
  },

  onLoad() {
    const app = getApp();
    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode,
      isLogin: app.globalData.isLogin,
      loading: true
    });

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });

    this.loadExamPapers();
  },

  onShow() {
    const app = getApp();
    // 每次页面显示时检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({
        darkMode
      });
      // 更新导航栏颜色
      wx.setNavigationBarColor({
        frontColor: darkMode ? '#ffffff' : '#000000',
        backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
      });
    }
    
    // 检查登录状态是否变化
    if (this.data.isLogin !== app.globalData.isLogin) {
      this.setData({
        isLogin: app.globalData.isLogin
      });
    }
    
    this.loadExamPapers();
  },

  loadExamPapers() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    this.setData({
      loading: true
    });
    
    setTimeout(() => {
      const wanweiConfig = require('../../config/wanwei');
      const examList = wanweiConfig.examList;
      
      // 按ID排序，最新的试卷排在前面
      const sortedExamList = examList.sort((a, b) => b.id - a.id);
      
      this.setData({
        examPapers: sortedExamList,
        loading: false
      });
      
      wx.hideLoading();
    }, 500); // 添加短暂延迟，使加载效果更自然
  },

  backToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  startExam(e) {
    const app = getApp();
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先在综合页面完成登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/comprehensive/comprehensive'
            });
          }
        }
      });
      return;
    }

    const { examId } = e.currentTarget.dataset;
    
    // 添加点击反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    wx.showLoading({
      title: '准备试卷...',
      mask: true
    });
    
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({
        url: `/packageExam/pages/wanwei-answer/wanwei-answer?examId=${examId}`,
        success: (res) => {
          console.log('跳转到答题页面成功');
        },
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    }, 300);
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.loadExamPapers();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
}); 