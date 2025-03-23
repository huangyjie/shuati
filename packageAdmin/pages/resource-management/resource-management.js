const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    resources: [],
    loading: true,
    darkMode: false,
    showAddModal: false,
    editingResource: null,
    formData: {
      title: '',
      type: '',
      description: '',
      link: '',
      thumbnail: ''
    },
    typeOptions: [
      { label: '学习资料', value: '学习资料' },
      { label: '考试真题', value: '考试真题' },
      { label: '政策文件', value: '政策文件' },
      { label: '调考分数', value: '调考分数' },
      { label: '学习笔记', value: '学习笔记' },
      { label: '题目答案', value: '题目答案' },
      { label: '模拟考试', value: '模拟考试' },
      { label: '模拟试卷', value: '模拟试卷' },
      { label: '技术文档', value: '技术文档' },
      { label: '实用工具', value: '实用工具' },
      { label: '其他资源', value: '其他资源' }
    ],
    uploadProgress: 0,
    showProgress: false,
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    searchKeyword: '',
    filterType: '',
    inputFocus: false
  },

  onLoad() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });

    if (darkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2d2d2d'
      });
    }

    this.loadResources();
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
      const _ = db.command;

      // 构建查询条件
      let query = {};
      if (this.data.searchKeyword) {
        query = _.or([
          {
            title: db.RegExp({
              regexp: this.data.searchKeyword,
              options: 'i'
            })
          },
          {
            description: db.RegExp({
              regexp: this.data.searchKeyword,
              options: 'i'
            })
          }
        ]);
      }

      if (this.data.filterType) {
        query.type = this.data.filterType;
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

  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;

    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  // 搜索资源
  onSearch(e) {
    this.setData({
      searchKeyword: e.detail.value,
      currentPage: 1,
      resources: [],
      hasMore: true
    });
    this.loadResources(true);
  },

  // 筛选类型
  onFilterType(e) {
    const index = e.detail.value;
    const selectedType = this.data.typeOptions[index].value;
    this.setData({
      filterType: selectedType,
      currentPage: 1,
      resources: [],
      hasMore: true
    });
    this.loadResources(true);
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      searchKeyword: '',
      filterType: '',
      currentPage: 1,
      resources: [],
      hasMore: true
    });
    this.loadResources(true);
  },

  // 获取文件类型
  getFileType(link) {
    if (!link) return 'other';
    const extension = link.split('.').pop().toLowerCase();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const docTypes = ['doc', 'docx'];
    const pdfType = ['pdf'];
    const excelTypes = ['xls', 'xlsx'];

    if (imageTypes.includes(extension)) return 'image';
    if (docTypes.includes(extension)) return 'doc';
    if (pdfType.includes(extension)) return 'pdf';
    if (excelTypes.includes(extension)) return 'excel';
    return 'other';
  },

  // 显示添加模态框
  showAddModal() {
    this.setData({
      showAddModal: true,
      editingResource: null,
      formData: {
        title: '',
        type: '',
        description: '',
        link: '',
        thumbnail: ''
      },
      inputFocus: true
    });

    setTimeout(() => {
      this.setData({
        inputFocus: true
      });
    }, 300);
  },

  // 显示编辑模态框
  showEditModal(e) {
    const { resource } = e.currentTarget.dataset;
    this.setData({
      showAddModal: true,
      editingResource: resource,
      formData: {
        title: resource.title,
        type: resource.type,
        description: resource.description,
        link: resource.link,
        thumbnail: resource.thumbnail || ''
      }
    });
  },

  // 关闭模态框
  closeModal() {
    this.setData({
      showAddModal: false,
      editingResource: null,
      uploadProgress: 0,
      showProgress: false
    });
  },

  // 处理表单输入
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    console.log('输入事件触发:', field, value);
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 选择资源类型
  onTypeChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.type': this.data.typeOptions[index].value
    });
  },

  // 验证URL
  validateUrl(url) {
    const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
    return pattern.test(url);
  },

  // 验证表单
  validateForm() {
    const { title, type, description, link } = this.data.formData;

    if (!title.trim()) {
      wx.showToast({
        title: '请输入资源标题',
        icon: 'none'
      });
      return false;
    }

    if (!type) {
      wx.showToast({
        title: '请选择资源类型',
        icon: 'none'
      });
      return false;
    }

    if (!description.trim()) {
      wx.showToast({
        title: '请输入资源描述',
        icon: 'none'
      });
      return false;
    }

    if (!link || !this.validateUrl(link)) {
      wx.showToast({
        title: '请输入有效的资源链接',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) return;

    try {
      wx.showLoading({ title: '保存中...' });
      const db = wx.cloud.database();
      const { formData, editingResource } = this.data;

      if (editingResource) {
        // 更新资源
        await db.collection('resources').doc(editingResource._id).update({
          data: {
            ...formData,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 添加资源
        await db.collection('resources').add({
          data: {
            ...formData,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      this.closeModal();
      this.loadResources(true);
    } catch (err) {
      wx.hideLoading();
      console.error('保存资源失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },

  // 删除资源
  async deleteResource(e) {
    const { id } = e.currentTarget.dataset;

    try {
      const res = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个资源吗？删除后无法恢复。',
        confirmColor: '#ff4d4f'
      });

      if (!res.confirm) return;

      wx.showLoading({ title: '删除中...' });

      const db = wx.cloud.database();
      await db.collection('resources').doc(id).remove();

      // 删除相关的云存储文件
      const resource = this.data.resources.find(item => item._id === id);
      if (resource) {
        const fileIDs = [resource.link];
        if (resource.thumbnail) {
          fileIDs.push(resource.thumbnail);
        }
        await wx.cloud.deleteFile({
          fileList: fileIDs
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });

      this.loadResources(true);
    } catch (err) {
      wx.hideLoading();
      console.error('删除资源失败:', err);
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  // 预览资源
  async previewResource(e) {
    try {
      const { link } = e.currentTarget.dataset;

      if (!link) {
        throw new Error('资源链接无效');
      }

      // 复制链接到剪贴板
      await wx.setClipboardData({
        data: link
      });

      wx.showToast({
        title: '链接已复制',
        icon: 'success'
      });

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
    await this.loadResources(true);
    wx.stopPullDownRefresh();
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.hasMore) {
      this.loadResources();
    }
  },

  // 选择缩略图
  async chooseThumbnail() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (res.tempFilePaths && res.tempFilePaths[0]) {
        const filePath = res.tempFilePaths[0];

        // 检查图片大小（2MB限制）
        const fileInfo = wx.getFileSystemManager().statSync(filePath);
        if (fileInfo.size > 2 * 1024 * 1024) {
          wx.showToast({
            title: '图片不能超过2MB',
            icon: 'none'
          });
          return;
        }

        this.setData({
          showProgress: true,
          uploadProgress: 0
        });

        // 上传到云存储
        const cloudPath = `thumbnails/${Date.now()}.${filePath.split('.').pop()}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: res => {
            this.setData({
              'formData.thumbnail': res.fileID,
              uploadProgress: 100
            });
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            });
          },
          fail: err => {
            console.error('上传失败：', err);
            wx.showToast({
              title: '上传失败',
              icon: 'error'
            });
          }
        });
      }
    } catch (err) {
      console.error('选择图片失败：', err);
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },
}); 