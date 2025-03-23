const app = getApp();

Page({
  data: {
    iconBaseUrl: app.globalData.iconBaseUrl,
    darkMode: false,
    showRules: false,
    userLevel: 1,
    progressPercent: 0,
    levelStars: [],
    isLogin: false,
    userInfo: null,
    levels: [
      {
        title: '初级关卡',
        desc: '基础入门题目',
        range: '1-15关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 1,
          stars: 0,
          unlocked: false
        }))
      },
      {
        title: '进阶关卡',
        desc: '提升巩固题目',
        range: '16-30关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 16,
          stars: 0,
          unlocked: false
        }))
      },
      {
        title: '提高关卡',
        desc: '深入理解题目',
        range: '31-45关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 31,
          stars: 0,
          unlocked: false
        }))
      },
      {
        title: '挑战关卡',
        desc: '综合应用题目',
        range: '46-60关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 46,
          stars: 0,
          unlocked: false
        }))
      },
      {
        title: '精英关卡',
        desc: '高级进阶题目',
        range: '61-75关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 61,
          stars: 0,
          unlocked: false
        }))
      },
      {
        title: '大师关卡',
        desc: '专家级题目',
        range: '76-90关',
        levels: Array.from({length: 15}, (_, i) => ({
          level: i + 76,
          stars: 0,
          unlocked: false
        }))
      }
    ]
  },

  onLoad() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ 
      darkMode,
      progressPercent: 0
    });
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  async checkLoginStatus() {
    const authInfo = wx.getStorageSync('authInfo');
    if (!authInfo?.isLogin || !authInfo?.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再进行答题闯关',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/comprehensive/comprehensive'
            });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    this.setData({
      isLogin: true,
      userInfo: authInfo.userInfo
    });
    await this.loadUserProgress();
  },

  // 加载用户进度
  async loadUserProgress() {
    try {
      const db = wx.cloud.database();
      const whereCondition = {};
      if (this.data.userInfo.openid) {
        whereCondition._openid = this.data.userInfo.openid;
      } else if (this.data.userInfo.phoneNumber) {
        whereCondition.phoneNumber = this.data.userInfo.phoneNumber;
      }

      const { data } = await db.collection('user_breakthrough')
        .where(whereCondition)
        .get();

      if (data && data.length > 0) {
        const progress = data[0];
        const level = progress.currentLevel || 1;
        this.setData({
          userLevel: level,
          progressPercent: Math.floor(level / 90 * 100),
          levelStars: progress.levelStars || new Array(90).fill(0)
        });
      } else {
        await db.collection('user_breakthrough').add({
          data: {
            currentLevel: 1,
            levelStars: new Array(90).fill(0),
            createTime: db.serverDate(),
            ...whereCondition
          }
        });
        
        this.setData({
          userLevel: 1,
          progressPercent: 1,
          levelStars: new Array(90).fill(0)
        });
      }
    } catch (err) {
      console.error('加载用户进度失败:', err);
    }
  },

  // 进入关卡
  enterLevel(e) {
    const level = e.currentTarget.dataset.level;
    if (level > this.data.userLevel) {
      wx.showToast({
        title: '请先通过前面的关卡',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/packageExam/pages/breakthrough-practice/breakthrough-practice?level=${level}&count=50`,
      fail: () => {
        wx.redirectTo({
          url: `/packageExam/pages/breakthrough-practice/breakthrough-practice?level=${level}&count=50`
        });
      }
    });
  },

  // 显示规则
  showRules() {
    this.setData({ showRules: true });
  },

  // 隐藏规则
  hideRules() {
    this.setData({ showRules: false });
  },

  // 防止点击穿透
  preventBubble() {
    return;
  }
}); 