// pages/profile/profile.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    version: '',  // 当前版本号
    developer: '开发者昵称',  // 开发者
    contact: 'QQ群(问题反馈): 输入你的QQ群号', // 联系方式
    description: '本小程序提供湖北省技能高考计算机基础知识练习题，题目来源于历年真题和教材，帮助考生备考。支持章节练习、随机练习、模拟考试等多种练习模式。',
    statusBarHeight: 0, // 状态栏高度
    features: [
      {
        title: '章节练习',
        desc: '按硬件、进制、网络、软件、信创五大章节分类练习'
      },
      {
        title: '高考抽题',
        desc: '从五大章节各抽10题组成模拟试卷，限时作答'
      },
      {
        title: 'AI辅助刷题',
        desc: '智能解析题目，提供详细解答和知识点讲解'
      },
      {
        title: '随机练习',
        desc: '随机抽取50道题目，不限时练习'
      },
      {
        title: '错题本',
        desc: '自动记录做错的题目，方便复习巩固'
      },
      {
        title: '收藏夹',
        desc: '收藏不熟悉的题目，可随时复习'
      },
    ],
    updateLog: [], // 更新日志数据
    maxResetTimes: 3, // 每日最大重置次数
    resetCount: 0, // 今日已重置次数
    nextVersion: null, // 下一版本预告数据
    darkMode: false,
    isLogin: false,
    userInfo: null,
    totalPoints: 0,
    totalAnswered: 0,
    correctRate: '0%',
    showLoginModal: false,
    isLoading: true, // 添加加载状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad() {
    const app = getApp();
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });

    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;

    // 从全局获取版本号
    const currentVersion = app.globalData.currentVersion;

    // 检查重置次数
    this.checkResetCount();

    // 更新版本号
    this.setData({
      darkMode,
      version: currentVersion,
    });

    // 设置导航栏颜色
    this.updateNavigationBarColor();

    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo')
    const isLogin = !!(authInfo && authInfo.isLogin && authInfo.userInfo)

    this.setData({
      isLogin,
      userInfo: authInfo?.userInfo || null
    })

    if (isLogin) {
      this.loadUserStats()
    }

    // 加载更新日志和下一版本预告
    await this.loadUpdateData();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '计算机基础刷题小程序',
      desc: '海量题库，随时随地复习计算机基础知识！',
      path: '/pages/index/index',
      imageUrl: `${this.data.iconBaseUrl}/share.png`
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '计算机基础刷题小程序 - 海量题库，随时随地复习！',
      query: '',
      imageUrl: `${this.data.iconBaseUrl}/share.png`
    }
  },

  // 复制联系方式
  copyContact() {
    wx.setClipboardData({
      data: this.data.contact,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 检查重置次数
  checkResetCount() {
    const today = new Date().toLocaleDateString();
    const resetInfo = wx.getStorageSync('resetInfo') || {};

    // 如果不是今天的记录，重置计数
    if (resetInfo.date !== today) {
      resetInfo.date = today;
      resetInfo.count = 0;
    }

    this.setData({
      resetCount: resetInfo.count || 0
    });
  },

  // 重置数据方法
  handleReset() {
    const today = new Date().toLocaleDateString();
    const resetInfo = wx.getStorageSync('resetInfo') || { date: today, count: 0 };

    // 如果不是今天的记录，重置计数
    if (resetInfo.date !== today) {
      resetInfo.date = today;
      resetInfo.count = 0;
    }

    // 检查重置次数是否超限
    if (resetInfo.count >= this.data.maxResetTimes) {
      wx.showModal({
        title: '提示',
        content: '今日重置次数已用完，请明天再试',
        showCancel: false
      });
      return;
    }

    wx.showModal({
      title: '确认重置',
      content: `重置将清除所有答题记录和错题本数据，今日剩余重置次数：${this.data.maxResetTimes - resetInfo.count - 1}次，确定要重置吗？`,
      success: (res) => {
        if (res.confirm) {
          // 清除所有本地存储的数据
          wx.removeStorageSync('totalAnswered');
          wx.removeStorageSync('wrongQuestions');
          wx.removeStorageSync('examRecords');
          wx.removeStorageSync('dailyStats');
          wx.removeStorageSync('userPoints');
          wx.removeStorageSync('dailyProgress'); // 清除每日进度
          wx.removeStorageSync('dailyTask'); // 清除每日任务

          // 清除所有试卷的进度
          for (let i = 1; i <= 9; i++) {
            wx.removeStorageSync(`exam${i}_progress`);
            wx.removeStorageSync(`exam${i}_answers`);
            wx.removeStorageSync(`exam${i}_answered`);
            wx.removeStorageSync(`packageExam/pages/wrong/wrong_${i}`);
          }

          // 更新重置次数
          resetInfo.count++;
          wx.setStorageSync('resetInfo', resetInfo);

          // 更新显示
          this.setData({
            resetCount: resetInfo.count
          });

          // 刷新页面
          const pages = getCurrentPages();
          const comprehensivePage = pages.find(page => page.route === 'pages/comprehensive/comprehensive');
          if (comprehensivePage) {
            comprehensivePage.loadDailyProgress();
          }

          wx.showToast({
            title: '重置成功',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 切换夜间模式
  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);

    const app = getApp();
    if (app.toggleDarkMode) {
      app.toggleDarkMode(darkMode);
    }
  },

  // 获取手机号
  async getPhoneNumber(e) {
    if (!e.detail.code) {
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
      return
    }

    try {
      // 使用云函数获取手机号
      const { result } = await wx.cloud.callFunction({
        name: 'getPhoneNumber',
        data: {
          code: e.detail.code
        }
      })

      if (!result.success || !result.phoneNumber) {
        throw new Error('获取手机号失败')
      }

      // 保存用户信息
      const userInfo = {
        phoneNumber: result.phoneNumber,
        nickName: '用户' + result.phoneNumber.slice(-4)
      }

      wx.setStorageSync('authInfo', {
        isLogin: true,
        userInfo
      })

      this.setData({
        isLogin: true,
        userInfo
      })

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

    } catch (err) {
      console.error('登录失败:', err)
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
    }
  },

  loadUserStats() {
    // 实现加载用户统计数据的逻辑
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

  // 加载更新日志和下一版本预告数据
  async loadUpdateData() {
    try {
      // 检查缓存是否过期
      const cacheTime = wx.getStorageSync('updateDataCacheTime');
      const currentTime = new Date().getTime();
      const cacheData = {
        updateLog: wx.getStorageSync('updateLogCache'),
        nextVersion: wx.getStorageSync('nextVersionCache')
      };

      // 如果缓存存在且未过期（24小时内），直接使用缓存
      if (cacheTime && currentTime - cacheTime < 24 * 60 * 60 * 1000 &&
        cacheData.updateLog && cacheData.updateLog.length > 0 &&
        cacheData.nextVersion) {
        this.setData({
          updateLog: cacheData.updateLog,
          nextVersion: cacheData.nextVersion,
          isLoading: false
        });
        return;
      }

      // 从云数据库加载数据
      const db = wx.cloud.database();

      // 加载更新日志
      const updateLogRes = await db.collection('update_logs')
        .orderBy('version', 'desc')
        .limit(5)
        .get();

      // 加载下一版本预告
      const nextVersionRes = await db.collection('next_version')
        .limit(1)
        .get();

      const updateData = {
        updateLog: updateLogRes.data,
        nextVersion: nextVersionRes.data[0]
      };

      // 更新缓存
      wx.setStorageSync('updateLogCache', updateData.updateLog);
      wx.setStorageSync('nextVersionCache', updateData.nextVersion);
      wx.setStorageSync('updateDataCacheTime', currentTime);

      // 更新页面数据
      this.setData({
        updateLog: updateData.updateLog,
        nextVersion: updateData.nextVersion,
        isLoading: false
      });

    } catch (error) {
      console.error('加载更新数据失败:', error);
      // 如果加载失败但有缓存，使用缓存数据
      const cachedUpdateLog = wx.getStorageSync('updateLogCache');
      const cachedNextVersion = wx.getStorageSync('nextVersionCache');

      if (cachedUpdateLog && cachedNextVersion) {
        this.setData({
          updateLog: cachedUpdateLog,
          nextVersion: cachedNextVersion,
          isLoading: false
        });
      }

      wx.showToast({
        title: '加载更新数据失败',
        icon: 'none'
      });
    }
  },
})