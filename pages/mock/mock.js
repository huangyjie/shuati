Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    mockPapers: [
      {
        id: 1,
        title: '模拟试卷',
        time: 30, // 考试时长(分钟)
        totalScore: 150,
        questionCount: 50,
        scorePerQuestion: 3,
        description: '本套试卷包含50道选择题，难度适中，时间30分钟，总分150分，每题3分。适合考前练习和实战演练。'
      },
    ],
    darkMode: false,
    isLogin: false,
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight
  },

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

  onLoad() {
    const app = getApp();
    const darkMode = wx.getStorageSync('darkMode') || false;

    this.setData({
      darkMode,
      isLogin: app.globalData.isLogin
    });

    this.updateNavigationBarColor();
  },

  onShow() {
    const app = getApp();
    const darkMode = wx.getStorageSync('darkMode') || false;

    if (this.data.darkMode !== darkMode || this.data.isLogin !== app.globalData.isLogin) {
      this.setData({
        darkMode,
        isLogin: app.globalData.isLogin
      });
      this.updateNavigationBarColor();
    }
  },

  startMockExam(e) {
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

    const { paperId } = e.currentTarget.dataset;
    wx.showModal({
      title: '开始模拟考试',
      content: '模拟考试开始后将计时，中途退出成绩将作废。是否确认开始？',
      success: (res) => {
        if (res.confirm) {
          console.log('开始模拟考试, paperId:', paperId);

          wx.navigateTo({
            url: `/packageExam/pages/mock-exam/mock-exam?paperId=${paperId}`,
            success: (res) => {
              console.log('页面跳转成功');
            },
            fail: (err) => {
              console.error('页面跳转失败:', err);
              wx.showToast({
                title: '页面跳转失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
});