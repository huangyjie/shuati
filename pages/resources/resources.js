Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    resources: [],
    loading: true,
    darkMode: false,
    typeOptions: [
      { label: '全部资料', value: '' },
      { label: '政策文件', value: '政策文件' },
      { label: '模拟试卷', value: '模拟试卷' },
      { label: '模拟考试', value: '模拟考试' },
      { label: '题目答案', value: '题目答案' },
      { label: '学习资料', value: '学习资料' },
      { label: '考试真题', value: '考试真题' },
      { label: '调考分数', value: '调考分数' },
      { label: '技术文档', value: '技术文档' },
      { label: '学习笔记', value: '学习笔记' },
      { label: '实用工具', value: '实用工具' },
      { label: '其他资源', value: '其他资源' }
    ],
    currentType: '',
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    totalCount: 0,
    currentTypeCount: 0
  },

  onLoad() {
    // 获取暗黑模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });

    // 设置导航栏颜色
    if (darkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2d2d2d'
      });
    }

    this.loadResources();
    this.loadResourcesCount();
  },

  // 获取资源总数
  async loadResourcesCount() {
    try {
      const db = wx.cloud.database();

      // 获取总数
      const { total: totalCount } = await db.collection('resources').count();

      // 获取当前类型的数量
      let currentTypeCount = totalCount;
      if (this.data.currentType) {
        const { total } = await db.collection('resources')
          .where({ type: this.data.currentType })
          .count();
        currentTypeCount = total;
      }

      this.setData({
        totalCount,
        currentTypeCount
      });
    } catch (err) {
      console.error('获取资源总数失败:', err);
    }
  },

  // 选择类型
  onTypeChange(e) {
    const type = this.data.typeOptions[e.currentTarget.dataset.index].value;
    this.setData({
      currentType: type,
      resources: [],
      currentPage: 1,
      hasMore: true
    });
    this.loadResources(true);
    this.loadResourcesCount();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadResources();
    }
  },

  // 加载资源列表
  async loadResources(isRefresh = false) {
    if (isRefresh) {
      this.setData({
        currentPage: 1,
        resources: [],
        hasMore: true
      });
    }

    if (!this.data.hasMore && !isRefresh) return;

    try {
      this.setData({ loading: true });
      const db = wx.cloud.database();

      // 构建查询条件
      let query = {};
      if (this.data.currentType) {
        query.type = this.data.currentType;
      }

      const { data } = await db.collection('resources')
        .where(query)
        .orderBy('createTime', 'desc')
        .skip((this.data.currentPage - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get();

      // 处理资源类型和时间格式
      const processedData = data.map(item => ({
        ...item,
        fileType: this.getFileType(item.link),
        createTime: this.formatTime(item.createTime)
      }));

      this.setData({
        resources: [...this.data.resources, ...processedData],
        loading: false,
        currentPage: this.data.currentPage + 1,
        hasMore: data.length === this.data.pageSize
      });
    } catch (err) {
      console.error('获取资源列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取文件类型
  getFileType(link) {
    if (!link) return 'other';
    const extension = link.split('.').pop().toLowerCase();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const docTypes = ['doc', 'docx'];
    const pdfType = ['pdf'];

    if (imageTypes.includes(extension)) return 'image';
    if (docTypes.includes(extension)) return 'doc';
    if (pdfType.includes(extension)) return 'pdf';
    return 'other';
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;

    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  // 预览资源
  async previewResource(e) {
    try {
      const { link } = e.currentTarget.dataset;
      if (!link) {
        throw new Error('文件ID不存在');
      }

      // 复制链接到剪贴板
      await wx.setClipboardData({
        data: link
      });

      wx.showToast({
        title: '链接已复制',
        icon: 'success'
      });

      // 询问是否打开链接
      const { confirm } = await wx.showModal({
        title: '提示',
        content: '链接已复制，是否打开链接？',
        confirmText: '打开',
        cancelText: '取消'
      });

      if (confirm) {
        // 使用内置浏览器打开链接
        wx.openUrl({
          url: link,
          fail: () => {
            // 如果不支持直接打开，提示用户在浏览器中打开
            wx.showToast({
              title: '请在浏览器中打开链接',
              icon: 'none'
            });
          }
        });
      }

    } catch (err) {
      console.error('预览资源失败:', err);
      wx.showToast({
        title: err.message || '预览失败',
        icon: 'none'
      });
    }
  },
  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadResources();
    wx.stopPullDownRefresh();
  }
}); 