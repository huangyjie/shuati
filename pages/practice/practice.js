const examConfig = require('../../config/examConfig');

Page({
  data: {
    examPapers: [],
    loading: true,
    darkMode: false,
    completedPapers: [],
    isLogin: false,
    isLoading: false,
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    completedCount: 0,
    remainingCount: 0,
    firstUncompletedIndex: -1,
    statusBarHeight: 0
  },

  onLoad() {
    const app = getApp();
    const darkMode = wx.getStorageSync('darkMode') || false;

    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });

    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    const isLogin = !!(authInfo && authInfo.isLogin && authInfo.userInfo);

    this.setData({
      darkMode,
      isLogin
    });

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#1f1f1f' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });

    this.loadExamPapers();
    if (isLogin) {
      this.loadCompletedPapers();
    }
  },

  async loadCompletedPapers() {
    if (this.data.isLoading) {
      return;
    }

    try {
      this.setData({ isLoading: true });

      const authInfo = wx.getStorageSync('authInfo');
      if (!authInfo || !authInfo.userInfo || !authInfo.userInfo.phoneNumber) {
        console.log('用户未登录或未授权手机号');
        this.setData({
          isLoading: false,
          completedCount: 0,
          remainingCount: this.data.examPapers.length || 0,
          firstUncompletedIndex: 0
        });
        return;
      }

      const db = wx.cloud.database();
      const _ = db.command;
      const phone = authInfo.userInfo.phoneNumber;

      // 先获取总记录数
      const { total } = await db.collection('completedPapers')
        .where({
          phone: phone,
          score: _.exists(true)
        })
        .count();

      console.log('总完成记录数:', total);

      // 分批获取所有记录，每批20条（云数据库限制）
      const batchSize = 20;
      const batchTimes = Math.ceil(total / batchSize);
      let allCompletedPapers = {};

      // 串行获取所有批次的数据
      for (let i = 0; i < batchTimes; i++) {
        const res = await db.collection('completedPapers')
          .where({
            phone: phone,
            score: _.exists(true)
          })
          .skip(i * batchSize)
          .limit(batchSize)
          .get();

        // 直接在这里处理每批数据，减少内存占用
        res.data.forEach(paper => {
          const chapterId = paper.chapterId.toString();
          const currentSubmitTime = new Date(paper.submitTime).getTime();

          if (!allCompletedPapers[chapterId] ||
            currentSubmitTime > new Date(allCompletedPapers[chapterId].submitTime).getTime()) {
            allCompletedPapers[chapterId] = paper;
          }
        });

        console.log(`已处理第${i + 1}批数据，当前批次数量：${res.data.length}，总处理数量：${Object.keys(allCompletedPapers).length}`);
      }

      // 转换为完成的章节ID数组，并按章节ID排序
      const completedChapterIds = Object.keys(allCompletedPapers)
        .filter(id => allCompletedPapers[id])
        .sort((a, b) => parseInt(a) - parseInt(b));

      console.log('去重后的完成章节数:', completedChapterIds.length);

      // 强制重新加载试卷列表
      const examList = examConfig.examList;
      const currentPapers = examList.map(paper => ({
        ...paper,
        isCompleted: completedChapterIds.includes(paper.id.toString())
      }));

      const completedCount = completedChapterIds.length;
      const remainingCount = currentPapers.length - completedCount;

      // 找到第一个未完成的试卷索引
      const firstUncompletedIndex = currentPapers.findIndex(paper => !paper.isCompleted);

      console.log(`用户 ${phone} 已完成 ${completedCount} 份试卷，章节ID列表:`, completedChapterIds);

      // 一次性设置所有数据
      await this.setData({
        isLoading: false,
        completedCount,
        remainingCount,
        firstUncompletedIndex: firstUncompletedIndex === -1 ? 0 : firstUncompletedIndex,
        completedPapers: completedChapterIds,
        examPapers: currentPapers
      });

      // 缓存最新的完成状态
      wx.setStorageSync('completedPapersCache', {
        timestamp: Date.now(),
        data: completedChapterIds
      });

    } catch (error) {
      console.error('加载已完成试卷失败:', error);
      this.setData({
        isLoading: false,
        completedPapers: [],
        completedCount: 0,
        remainingCount: this.data.examPapers.length || 0,
        firstUncompletedIndex: 0
      });
    }
  },

  onShow() {
    // 只在页面显示时加载一次
    this.loadCompletedPapers();
  },

  loadExamPapers() {
    const examList = examConfig.examList;
    const papers = examList.map(paper => ({
      ...paper,
      isCompleted: false
    }));

    this.setData({
      examPapers: papers,
      loading: false,
      completedCount: 0,
      remainingCount: papers.length,
      firstUncompletedIndex: 0
    });
  },

  // 检查本地缓存中是否有题目
  checkLocalQuestions(paperId) {
    try {
      const key = `paper_${paperId}_questions`;
      const localQuestions = wx.getStorageSync(key);
      if (localQuestions && localQuestions.length > 0) {
        console.log('从本地缓存获取到试卷题目:', paperId);
        return localQuestions;
      }
      return null;
    } catch (err) {
      console.error('检查本地缓存失败:', err);
      return null;
    }
  },

  startExam(e) {
    const { examId } = e.currentTarget.dataset;
    if (!examId) {
      wx.showToast({
        title: '试卷ID无效',
        icon: 'error'
      });
      return;
    }

    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    if (!authInfo || !authInfo.isLogin || !authInfo.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先在综合页面登录后再答题',
        showCancel: false
      });
      return;
    }

    console.log('点击开始答题, examId:', examId);

    // 检查本地是否有缓存的题目
    const localQuestions = this.checkLocalQuestions(examId);
    const params = localQuestions ? `paperId=${examId}&hasCache=true` : `paperId=${examId}`;

    wx.navigateTo({
      url: `/packageExam/pages/answer/answer?${params}`,
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
  },

  async getQuestions() {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('questions')
        .limit(5)
        .get()

      if (!data || data.length === 0) {
        throw new Error('没有找到题目')
      }

      return data
    } catch (err) {
      console.error('获取题目失败:', err)
      throw err
    }
  },

  // 切换深色模式
  toggleDarkMode() {
    const darkMode = !this.data.darkMode;
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
  },

  // 滚动到未完成的试卷
  scrollToUncompleted() {
    if (this.data.firstUncompletedIndex === -1) {
      wx.showToast({
        title: '没有未完成的试卷',
        icon: 'none'
      });
      return;
    }

    const query = wx.createSelectorQuery();
    query.selectAll('.exam-card').boundingClientRect().exec(res => {
      if (!res || !res[0] || !res[0][this.data.firstUncompletedIndex]) {
        return;
      }

      // 获取第一个未完成试卷的位置
      const targetCard = res[0][this.data.firstUncompletedIndex];

      // 获取页面滚动位置
      wx.createSelectorQuery().selectViewport().scrollOffset().exec(scrollRes => {
        if (!scrollRes || !scrollRes[0]) return;

        const currentScroll = scrollRes[0].scrollTop;
        const targetScroll = currentScroll + targetCard.top - 100; // 预留100rpx的顶部空间

        wx.pageScrollTo({
          scrollTop: targetScroll,
          duration: 300
        });
      });
    });
  }
}); 