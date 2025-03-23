const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    illegalAccounts: [],
    loading: true,
    darkMode: false,
    pageSize: 20,
    currentPage: 0,
    hasMore: true,
    totalCount: 0,
    defaultAvatarUrl: '/assets/images/default-avatar.png'
  },

  onLoad: function() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.getTotalCount();
  },

  // 获取用户总数
  async getTotalCount() {
    try {
      const { total } = await db.collection('users').count();
      console.log('用户总数：', total);
      this.setData({ totalCount: total }, () => {
        this.loadIllegalAccounts(true);
      });
    } catch (err) {
      console.error('获取用户总数失败：', err);
    }
  },

  // 检查昵称是否合法
  isValidNickname(nickname) {
    if (!nickname) return false;
    
    // 检查是否包含表情符号
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF]|[\u2600-\u27FF]|[\u2300-\u23FF]|[\u2B50]|[\u2614-\u2615]|[\u3297]|[\u3299]|[\uFE0F]/g;
    
    // 检查是否包含标点符号和特殊字符
    const punctuationRegex = /[~!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>/?！￥…（）—【】、；：''""，。《》？·`～！@#¥%：；、。，？！]/;
    
    // 如果包含表情符号，返回false
    if (emojiRegex.test(nickname)) {
      console.log(`检测到违规昵称(表情符号)：${nickname}`);
      return false;
    }
    
    // 如果包含标点符号，返回false
    if (punctuationRegex.test(nickname)) {
      console.log(`检测到违规昵称(标点符号)：${nickname}`);
      return false;
    }
    
    return true;
  },

  // 加载违规账号
  async loadIllegalAccounts(isRefresh = true) {
    if (isRefresh) {
      this.setData({
        currentPage: 0,
        illegalAccounts: [],
        hasMore: true,
        loading: true
      });
    }

    if (!this.data.hasMore) return;

    try {
      // 分页获取用户数据
      const { data } = await db.collection('users')
        .field({
          _id: true,
          nickName: true,
          phoneNumber: true,
          points: true,
          totalQuestions: true,
          avatarUrl: true
        })
        .skip(this.data.currentPage * this.data.pageSize)
        .limit(this.data.pageSize)
        .get();

      console.log(`第${this.data.currentPage + 1}页数据：`, data.length);
      
      // 处理头像URL并检测违规昵称
      const illegalAccounts = data
        .map(user => ({
          ...user,
          avatarUrl: user.avatarUrl || this.data.defaultAvatarUrl
        }))
        .filter(user => !this.isValidNickname(user.nickName));

      console.log(`本页发现违规昵称：${illegalAccounts.length}个`);

      // 更新数据
      this.setData({
        illegalAccounts: [...this.data.illegalAccounts, ...illegalAccounts],
        currentPage: this.data.currentPage + 1,
        hasMore: data.length === this.data.pageSize
      });

      // 更新进度
      const progress = Math.min(100, Math.round((this.data.currentPage * this.data.pageSize / this.data.totalCount) * 100));
      wx.showLoading({
        title: `加载中(${progress}%)`,
        mask: true
      });

      // 如果还有更多数据，继续加载
      if (this.data.hasMore) {
        // 添加延时，避免频繁请求
        setTimeout(() => {
          this.loadIllegalAccounts(false);
        }, 300);
      } else {
        this.setData({ loading: false });
        wx.hideLoading();
        // 显示违规账号数量
        const total = this.data.illegalAccounts.length;
        if (total > 0) {
          wx.showToast({
            title: `共发现${total}个违规昵称`,
            icon: 'none',
            duration: 2000
          });
        }
        console.log('加载完成，共发现违规昵称：', total);
      }
    } catch (err) {
      console.error('加载违规账号失败：', err);
      this.setData({ loading: false });
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  // 处理头像加载错误
  handleAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const illegalAccounts = [...this.data.illegalAccounts];
    illegalAccounts[index].avatarUrl = this.data.defaultAvatarUrl;
    this.setData({ illegalAccounts });
  },

  // 一键修改违规昵称
  async batchRenameIllegalAccounts() {
    try {
      wx.showModal({
        title: '确认修改',
        content: `确定要修改这${this.data.illegalAccounts.length}个违规昵称吗？此操作不可撤销。`,
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '正在修改(0%)', mask: true });
            
            const { illegalAccounts } = this.data;
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < illegalAccounts.length; i++) {
              const account = illegalAccounts[i];
              const newNickName = `违规昵称${String(i + 1).padStart(6, '0')}`;
              
              try {
                await db.collection('users').doc(account._id).update({
                  data: {
                    nickName: newNickName,
                    lastModified: db.serverDate()
                  }
                });
                successCount++;

                // 更新进度
                const progress = Math.round((i + 1) / illegalAccounts.length * 100);
                wx.showLoading({
                  title: `正在修改(${progress}%)`,
                  mask: true
                });
              } catch (err) {
                console.error(`修改用户 ${account.phoneNumber} 昵称失败：`, err);
                failCount++;
              }
            }

            wx.hideLoading();
            wx.showToast({
              title: `成功${successCount}个，失败${failCount}个`,
              icon: 'none',
              duration: 3000
            });

            // 重新加载数据
            setTimeout(() => {
              this.loadIllegalAccounts(true);
            }, 3000);
          }
        }
      });
    } catch (err) {
      console.error('批量修改昵称失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '修改失败',
        icon: 'error'
      });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.getTotalCount();
    wx.stopPullDownRefresh();
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadIllegalAccounts(false);
    }
  }
}); 