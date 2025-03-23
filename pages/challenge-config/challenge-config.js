const COLLECTIONS = {
  'questions': '总题库',
  'hardware': '硬件题库',
  'Base': '进制题库',
  'Internet': '网络题库',
  'Software': '软件题库',
  'Xinchuang': '信创题库',
  'wanwei': '万维调考'
};

Page({
  data: {
    darkMode: false,
    duration: 30, // 默认30分钟
    questionCount: 50, // 默认50题
    scorePerQuestion: 3, // 默认每题3分
    targetScore: 150, // 默认目标分数 (50题 * 3分)
    collections: COLLECTIONS, // 题库列表
    selectedCollection: 'questions', // 默认选择总题库
    showCollectionPicker: false // 控制题库选择器的显示
  },

  onLoad() {
    // 获取深色模式状态
    this.setData({
      darkMode: wx.getStorageSync('darkMode') || false
    });
    this.calculateTargetScore();
  },

  // 显示题库选择器
  showCollectionPicker() {
    this.setData({
      showCollectionPicker: true
    });
  },

  // 隐藏题库选择器
  hideCollectionPicker() {
    this.setData({
      showCollectionPicker: false
    });
  },

  // 选择题库
  selectCollection(e) {
    const { collection } = e.currentTarget.dataset;
    this.setData({
      selectedCollection: collection,
      showCollectionPicker: false
    });
  },

  // 获取当前选中题库名称
  getSelectedCollectionName() {
    return this.data.collections[this.data.selectedCollection];
  },

  // 处理答题时间输入
  onDurationInput(e) {
    let value = e.detail.value;
    // 允许空值输入
    if (value === '') {
      this.setData({ duration: value });
      return;
    }
    
    value = parseInt(value);
    // 只在超出范围时进行限制
    if (value > 60) value = 60;
    
    this.setData({
      duration: value
    });
  },

  // 处理题目数量输入
  onQuestionCountInput(e) {
    let value = e.detail.value;
    // 允许空值输入
    if (value === '') {
      this.setData({ 
        questionCount: value,
        targetScore: 0
      });
      return;
    }
    
    value = parseInt(value);
    // 只在超出范围时进行限制
    if (value > 150) value = 150;
    
    this.setData({
      questionCount: value
    });
    this.calculateTargetScore();
  },

  // 处理分值输入
  onScoreInput(e) {
    let value = e.detail.value;
    // 允许空值输入
    if (value === '') {
      this.setData({ 
        scorePerQuestion: value,
        targetScore: 0
      });
      return;
    }
    
    value = parseInt(value);
    // 只在超出范围时进行限制
    if (value > 10) value = 10;
    
    this.setData({
      scorePerQuestion: value
    });
    this.calculateTargetScore();
  },

  // 计算目标总分
  calculateTargetScore() {
    const { questionCount, scorePerQuestion } = this.data;
    // 确保两个值都是有效数字
    if (!isNaN(questionCount) && !isNaN(scorePerQuestion)) {
      const targetScore = questionCount * scorePerQuestion;
      this.setData({ targetScore });
    }
  },

  // 开始挑战
  startChallenge() {
    const { duration, questionCount, scorePerQuestion, targetScore, selectedCollection } = this.data;
    
    // 验证输入值的合法性
    if (!duration || duration < 1 || duration > 60) {
      wx.showToast({
        title: '请设置1-60分钟',
        icon: 'none'
      });
      return;
    }
    
    if (!questionCount || questionCount < 5 || questionCount > 150) {
      wx.showToast({
        title: '请设置5-150题',
        icon: 'none'
      });
      return;
    }
    
    if (!scorePerQuestion || scorePerQuestion < 1 || scorePerQuestion > 10) {
      wx.showToast({
        title: '请设置1-10分',
        icon: 'none'
      });
      return;
    }

    // 将配置保存到本地存储
    const challengeConfig = {
      duration,
      questionCount,
      scorePerQuestion,
      targetScore,
      selectedCollection
    };
    wx.setStorageSync('challengeConfig', challengeConfig);

    // 跳转到答题页面
    wx.navigateTo({
      url: '/pages/challenge/challenge'
    });
  }
}); 