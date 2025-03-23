// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

// 初始化云环境
wx.cloud.init({
  env: 'name-xxx', // 请填入您的环境ID
  traceUser: true
});

// 题库集合配置
const COLLECTIONS = {
  'questions': '总题库',
  'hardware': '硬件题库',
  'Base': '进制题库',
  'Internet': '网络题库',
  'Software': '软件题库',
  'Xinchuang': '信创题库',
  'wanwei': '万维调考题库'
};

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    showAnnouncement: false,
    announcement: null,
    totalQuestionBank: 0,
    collectionCounts: {},
    showCollectionDetail: false,
    qqNumber: '1011860345',
    showSettings: false,
    showSponsor: false,
    showMorePanel: false,
    darkMode: false,
    countdown: {
      days: 0,
      examDate: '',
      motivationalQuote: ''
    },
    showCountdownDetail: false,
    systemMessage: `距离高考还有不足一个月，祝大家考试顺利！`,  //系统底部提示
    showSystemBanner: true,
    sponsors: [], // 赞助者列表
    userAnswerCount: 0, // 用户答题数量
    wrongQuestionsCount: 0, // 错题数量
    isLogin: false,
    userInfo: null,
    defaultAvatarUrl: defaultAvatarUrl, // 添加默认头像URL
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight // 获取状态栏高度
  },

  // 添加加载答题天数的方法
  async loadAnswerDays() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        return;
      }

      const db = wx.cloud.database();
      const { data } = await db.collection('user_answer_records')
        .where({
          _openid: app.globalData.openid
        })
        .field({
          date: true
        })
        .get();

      // 使用Set来统计不重复的日期数量
      const uniqueDays = new Set(data.map(record => record.date.split(' ')[0]));

      this.setData({
        answerDays: uniqueDays.size
      });
    } catch (err) {
      console.error('获取答题天数失败:', err);
    }
  },

  onLoad() {
    this.checkAnnouncement();
    this.loadTotalQuestionBank();
    this.loadUserAnswerCount();
    this.loadWrongQuestionsCount();
    this.checkSystemBanner();
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });

    if (darkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2d2d2d'
      });
      wx.setTabBarStyle({
        backgroundColor: '#2d2d2d',
        borderStyle: 'black',
        color: '#8a8a8a',
        selectedColor: '#1aad19'
      });
    }

    this.calculateCountdown();
    this.setUpdateTimer();
    this.loadSponsors();

    // 获取用户信息
    const app = getApp();
    if (app.globalData.userInfo) {
      const userInfo = app.globalData.userInfo;
      this.setData({
        isLogin: true,
        userInfo: {
          ...userInfo,
          nickname: userInfo.nickName || userInfo.nickname || '未登录',
          points: userInfo.points || 0,
          avatarUrl: userInfo.avatarUrl || defaultAvatarUrl
        }
      });
    }
  },

  onShow() {
    this.loadUserAnswerCount();
    this.loadWrongQuestionsCount(); // 每次显示页面时更新错题数量
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: {
        ...userInfo,
        nickname: userInfo.nickName || userInfo.nickname || '未登录',
        points: userInfo.points || 0,
        avatarUrl: userInfo.avatarUrl || defaultAvatarUrl
      }
    });
  },

  startPractice() {
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

    wx.switchTab({
      url: '/pages/practice/practice'
    });
  },

  startRandomPractice() {
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

    wx.navigateTo({
      url: '/packageExam/pages/random-practice/random-practice'
    });
  },

  startAIPractice() {
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

    wx.navigateTo({
      url: '/packageExam/pages/ai-practice/ai-practice'
    });
  },

  copyQQ() {
    wx.setClipboardData({
      data: this.data.qqNumber,
      success: () => {
        wx.showToast({
          title: '群号已复制',
          icon: 'success',
          duration: 2000
        })
      }
    })
  },

  // 复制群号方法
  copyGroupNumber() {
    wx.navigateTo({
      url: '/pages/qq-groups/qq-groups',
      fail: (err) => {
        console.error('跳转到QQ群页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  toggleSettings() {
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

    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  toggleSponsor() {
    this.setData({
      showSponsor: !this.data.showSponsor
    });
  },

  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);

    // 更新导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#1f1f1f' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });

    // 更新底部TabBar样式
    wx.setTabBarStyle({
      backgroundColor: darkMode ? '#1f1f1f' : '#ffffff',
      borderStyle: darkMode ? 'black' : 'white',
      color: darkMode ? '#8a8a8a' : '#7f7f7f',
      selectedColor: '#1aad19'
    });

    const app = getApp();
    if (app.toggleDarkMode) {
      app.toggleDarkMode(darkMode);
    }
  },

  preventBubble() {
    // 空方法，用于阻止事件冒泡
  },

  startChapterPractice() {
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

    wx.navigateTo({
      url: '/pages/chapters/chapters',
      success: (res) => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  startExamPractice() {
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

    wx.navigateTo({
      url: '/packageExam/pages/gaokao-exam/gaokao-exam'
    });
  },

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  // 添加计算倒计时的方法
  calculateCountdown() {
    const now = new Date();
    const currentYear = now.getFullYear();

    // 今年的考试日期（4月7日）
    let examDate = new Date(currentYear, 3, 8); // 月份从0开始，3表示4月

    // 如果当前日期已过今年考试日期，使用明年的考试日期
    if (now > examDate) {
      examDate = new Date(currentYear + 1, 3, 7);
    }

    // 计算剩余天数
    const timeDiff = examDate.getTime() - now.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24));

    this.setData({
      'countdown.days': days
    });
  },

  // 设置定时器，保每天凌晨更新倒计时
  setUpdateTimer() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeToTomorrow = tomorrow.getTime() - now.getTime();

    // 设置定时器，在明天凌晨触发
    setTimeout(() => {
      this.calculateCountdown();
      // 新设置定时器
      this.setUpdateTimer();
    }, timeToTomorrow);
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
  },

  // 修改加载题库总数的方法
  async loadTotalQuestionBank() {
    try {
      // 获取缓存的题库数据和最后更新时间
      const cachedData = wx.getStorageSync('questionBankData');
      const lastUpdateTime = wx.getStorageSync('questionBankUpdateTime');
      const now = new Date().getTime();

      // 检查是否需要更新数据(一周的毫秒数: 7 * 24 * 60 * 60 * 1000 = 604800000)
      if (cachedData && lastUpdateTime && (now - lastUpdateTime < 604800000)) {
        console.log('使用缓存的题库数据');
        this.setData({
          totalQuestionBank: cachedData.total,
          collectionCounts: cachedData.collections
        });
        return;
      }

      console.log('开始更新题库数据');
      wx.showLoading({
        title: '更新题库数据...',
        mask: true
      });

      const db = wx.cloud.database();
      let total = 0;
      const collectionCounts = {};

      // 获取每个集合的题目数量
      for (const [collection, name] of Object.entries(COLLECTIONS)) {
        try {
          const { total: count } = await db.collection(collection).count();
          collectionCounts[collection] = {
            name: name,
            count: count
          };
          total += count;
        } catch (err) {
          console.error(`获取${collection}(${name})题目数量失败:`, err);
          // 如果获取失败，使用缓存中的数据（如果有的话）
          if (cachedData && cachedData.collections[collection]) {
            collectionCounts[collection] = cachedData.collections[collection];
            total += cachedData.collections[collection].count;
          } else {
            collectionCounts[collection] = {
              name: name,
              count: 0
            };
          }
        }
      }

      // 缓存新数据和更新时间
      const questionBankData = {
        total: total,
        collections: collectionCounts,
        updateTime: now
      };
      wx.setStorageSync('questionBankData', questionBankData);
      wx.setStorageSync('questionBankUpdateTime', now);

      this.setData({
        totalQuestionBank: total,
        collectionCounts: collectionCounts
      });

      wx.hideLoading();

    } catch (error) {
      console.error('获取题库总数失败:', error);
      wx.hideLoading();

      // 如果更新失败但有缓存数据，使用缓存数据
      const cachedData = wx.getStorageSync('questionBankData');
      if (cachedData) {
        this.setData({
          totalQuestionBank: cachedData.total,
          collectionCounts: cachedData.collections
        });
      }

      wx.showToast({
        title: '更新题库数据失败',
        icon: 'none'
      });
    }
  },

  // 添加切换显示细分的方法
  toggleCollectionDetail() {
    this.setData({
      showCollectionDetail: !this.data.showCollectionDetail
    });
  },

  // 添加加载赞助者的方法
  loadSponsors() {
    const db = wx.cloud.database();
    db.collection('sponsor')
      .orderBy('_createTime', 'desc')
      .limit(10)
      .get()
      .then(res => {
        this.setData({
          sponsors: res.data.map(item => item.name)
        });
      })
      .catch(err => {
        console.error('获取赞助者列表失败:', err);
      });
  },

  // 检查公告
  async checkAnnouncement() {
    console.log('开始检查公告');
    // 检查是否在七天内已经显示过
    const lastShowTime = wx.getStorageSync('lastAnnouncementShowTime');
    const lastAnnouncementId = wx.getStorageSync('lastAnnouncementId');
    const now = new Date().getTime();

    const db = wx.cloud.database();
    try {
      console.log('正在获取公告数据...');
      const { data } = await db.collection('announcements')
        .orderBy('createTime', 'desc')
        .limit(1)
        .get();

      if (data && data.length > 0) {
        const announcement = data[0];
        // 如果是新公告或者公告被更新了，直接显示
        if (!lastAnnouncementId || lastAnnouncementId !== announcement._id) {
          console.log('发现新公告，显示公告');
          this.setData({
            announcement,
            showAnnouncement: true
          });
          return;
        }

        // 如果是同一条公告，检查七天限制
        if (lastShowTime && (now - lastShowTime < 7 * 24 * 60 * 60 * 1000)) {
          console.log('七天内已显示过公告，跳过');
          return;
        }

        // 超过七天，重新显示
        if (announcement.isActive) {
          console.log('公告已激活，显示公告');
          this.setData({
            announcement,
            showAnnouncement: true
          });
        }
      }
    } catch (err) {
      console.error('获取公告失败:', err);
    }
  },

  // 关闭公告
  closeAnnouncement(e) {
    const notShowAgain = e.currentTarget.dataset.notshow;
    const now = new Date().getTime();

    // 只有点击"七天内不再提醒"时才记录时间和ID
    if (notShowAgain) {
      wx.setStorageSync('lastAnnouncementShowTime', now);
      wx.setStorageSync('lastAnnouncementId', this.data.announcement._id);
    }

    // 添加渐隐动画
    this.setData({
      showAnnouncement: false
    });

    // 300ms后清除公告数据
    setTimeout(() => {
      this.setData({
        announcement: null
      });
    }, 300);
  },

  // 跳转到友情链接页面
  showFriendLinks() {
    wx.navigateTo({
      url: '/pages/friend-links/friend-links'
    });
  },

  toggleFriendLinks() {
    this.setData({
      showFriendLinks: !this.data.showFriendLinks
    });
  },

  copyFriendLink(e) {
    const url = e.currentTarget.dataset.url;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  // 添加跳转方法
  navigateToFriendLinks() {
    wx.navigateTo({
      url: '/pages/friend-links/friend-links'
    });
  },

  // 添加获取用户答题数据的方法
  async loadUserAnswerCount() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      // 构建查询条件
      const whereCondition = {};
      if (app.globalData.userInfo.openid) {
        whereCondition._openid = app.globalData.userInfo.openid;
      } else if (app.globalData.userInfo.phoneNumber) {
        whereCondition.phoneNumber = app.globalData.userInfo.phoneNumber;
      } else {
        return;
      }

      // 从users集合中获取用户的答题统计数据
      const { data } = await db.collection('users')
        .where(whereCondition)
        .field({
          totalQuestions: true,
          correctQuestions: true,
          wrongQuestions: true
        })
        .get();

      if (data && data.length > 0) {
        const userStats = data[0];
        this.setData({
          userAnswerCount: userStats.totalQuestions || 0,
          wrongQuestionsCount: userStats.wrongQuestions || 0
        });

        console.log('用户答题统计：', userStats);
      }
    } catch (err) {
      console.error('获取用户答题数据失败：', err);
    }
  },

  // 跳转到对战页面
  navigateToBattle() {
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

    // 检查是否是管理员账号
    if (app.globalData.userInfo?.phoneNumber !== '13797433906') {
      wx.showModal({
        title: '提示',
        content: '在线对战功能正在开发中，敬请期待',
        showCancel: false
      });
      return;
    }

    // 是管理员账号则允许进入
    wx.navigateTo({
      url: '/pages/battle/battle'
    });
  },

  startPointsPractice() {
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

    wx.navigateTo({
      url: '/pages/points-practice/points-practice',
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 修改交流室跳转函数
  navigateToChatRoom() {
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

    wx.navigateTo({
      url: '/pages/chat-room/chat-room',
      fail: (err) => {
        console.error('跳转到交流室失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加万维调考跳转函数
  navigateToWanwei() {
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

    wx.navigateTo({
      url: '/pages/wanwei/wanwei',
      fail: (err) => {
        console.error('跳转到万维调考失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加跳转到开发者名单的函数
  navigateToDevelopers() {
    wx.navigateTo({
      url: '/pages/developers/developers',
      fail: (err) => {
        console.error('跳转到开发者名单失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加跳转到赞助者列表页面的函数
  navigateToSponsors() {
    wx.navigateTo({
      url: '/pages/sponsors/sponsors',
      fail: (err) => {
        console.error('跳转到赞助者列表失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加积分商店跳转函数
  navigateToPointsShop() {
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

    wx.navigateTo({
      url: '/pages/points-shop/points-shop',
      fail: (err) => {
        console.error('跳转到积分商店失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加挑战自己功能
  startChallenge() {
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

    wx.navigateTo({
      url: '/pages/challenge-config/challenge-config',
      fail: (err) => {
        console.error('跳转到挑战配置页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加答题闯关功能
  startBreakthrough() {
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

    wx.navigateTo({
      url: '/pages/breakthrough/breakthrough',
      fail: (err) => {
        console.error('跳转到答题闯关页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加显示最新公告的方法
  async showLatestAnnouncement() {
    const db = wx.cloud.database();
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      const { data } = await db.collection('announcements')
        .orderBy('createTime', 'desc')
        .limit(1)
        .get();

      wx.hideLoading();

      if (data && data.length > 0) {
        const announcement = data[0];
        this.setData({
          announcement,
          showAnnouncement: true
        });
      } else {
        wx.showToast({
          title: '暂无公告',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('获取公告失败:', err);
      wx.showToast({
        title: '获取公告失败',
        icon: 'none'
      });
    }
  },

  // 加载错题数量
  loadWrongQuestionsCount() {
    try {
      const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      this.setData({
        wrongQuestionsCount: wrongQuestions.length
      });
    } catch (err) {
      console.error('获取错题数量失败：', err);
    }
  },

  // 跳转到资源浏览页面
  navigateToResources() {
    wx.navigateTo({
      url: '/pages/resources/resources'
    });
  },

  // 添加更多面板的显示/隐藏方法
  toggleMorePanel() {
    this.setData({
      showMorePanel: !this.data.showMorePanel
    });
  },

  // 添加显示倒计时详情的方法
  showCountdownDetail() {
    const quotes = [
      "不要让任何事物阻挡你前进的脚步，坚持就是胜利！",
      "成功不是偶然的，而是来自每一天的积累和坚持。",
      "相信自己，你比想象中更强大！",
      "今天的汗水是明天的成功之源。",
      "没有人能替你奋斗，也没有人能阻挡你奋斗！",
      "不要轻言放弃，因为你不知道下一秒会发生什么。",
      "梦想的道路上没有捷径，只有脚踏实地的努力。",
      "每一个优秀的人，都有一段沉默的时光。",
      "坚持下去，你就是自己的光！",
      "现在的努力，是为了将来的你不后悔。"
    ];

    // 随机选择一条励志语录
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // 格式化考试日期
    const examDate = new Date(new Date().getFullYear(), 3, 7); // 4月7日
    if (examDate < new Date()) {
      examDate.setFullYear(examDate.getFullYear() + 1);
    }
    const formattedDate = `${examDate.getFullYear()}年4月7日`;

    this.setData({
      'countdown.motivationalQuote': randomQuote,
      'countdown.examDate': formattedDate,
      showCountdownDetail: true
    });
  },

  // 关闭倒计时详情
  closeCountdownDetail() {
    this.setData({
      showCountdownDetail: false
    });
  },

  // 添加检查系统条幅的方法
  checkSystemBanner() {
    const lastShowTime = wx.getStorageSync('lastSystemBannerShowTime');
    const now = new Date().getTime();
    const today = new Date().setHours(0, 0, 0, 0);

    // 如果今天没有显示过，则显示
    if (!lastShowTime || new Date(lastShowTime).setHours(0, 0, 0, 0) < today) {
      this.setData({
        showSystemBanner: true
      });
    } else {
      this.setData({
        showSystemBanner: false
      });
    }
  },

  // 添加关闭系统条幅的方法
  closeSystemBanner() {
    const now = new Date().getTime();
    wx.setStorageSync('lastSystemBannerShowTime', now);
    this.setData({
      showSystemBanner: false
    });
  },

  // 添加AI对话跳转函数
  navigateToAIChat() {
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

    wx.navigateTo({
      url: '/pages/ai-chat/ai-chat',
      fail: (err) => {
        console.error('跳转到AI对话页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  goToWrongBook() {
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

    wx.navigateTo({
      url: '/pages/wrong/wrong',
      fail: (err) => {
        console.error('跳转到错题本失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  goToFavorites() {
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

    wx.navigateTo({
      url: '/pages/favorites-practice/favorites-practice',
      fail: (err) => {
        console.error('跳转到收藏页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  navigateToSearch() {
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

    wx.navigateTo({
      url: '/pages/search/search',
      fail: (err) => {
        console.error('跳转到搜索页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

});
