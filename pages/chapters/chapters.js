Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    chapters: [
      {
        id: 'hardware',
        title: '硬件',
        description: '计算机硬件相关知识',
        collectionId: 'hardware'
      },
      {
        id: 'Base',
        title: '进制',
        description: '二进制、八进制、十六进制转换',
        collectionId: 'Base'
      },
      {
        id: 'Internet',
        title: '网络',
        description: '计算机网络基础知识',
        collectionId: 'Internet'
      },
      {
        id: 'Software',
        title: '软件',
        description: '操作系统与应用软件',
        collectionId: 'Software'
      },
      {
        id: 'Xinchuang',
        title: '信创',
        description: '信息技术应用创新',
        collectionId: 'Xinchuang'
      },
      {
        id: 'mixed',
        title: '综合练习',
        description: '从所有章节随机抽题练习',
        collectionId: 'hardware',
        collections: ['hardware', 'Base', 'Internet', 'Software', 'Xinchuang', 'wanwei']
      },
      {
        id: 'wanwei',
        title: '万维调考',
        description: '万维调考真题练习',
        collectionId: 'wanwei',
        isNew: true
      }
    ],
    darkMode: false
  },

  onLoad() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.updateNavigationBarColor();
  },

  onShow() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }
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

  startChapterPractice(e) {
    const { chapterId } = e.currentTarget.dataset;
    const chapter = this.data.chapters.find(item => item.id === chapterId);

    if (!chapter) {
      wx.showToast({
        title: '章节不存在',
        icon: 'none'
      });
      return;
    }

    let collectionId = chapter.collectionId;
    if (chapter.id === 'mixed') {
      const randomIndex = Math.floor(Math.random() * chapter.collections.length);
      collectionId = chapter.collections[randomIndex];
    }

    console.log('选择章节:', chapterId, '集合:', collectionId);

    wx.navigateTo({
      url: `/packageExam/pages/chapter-answer/chapter-answer?chapterId=${chapterId}&collectionId=${collectionId}&isMixed=${chapter.id === 'mixed'}`,
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
  }
}); 