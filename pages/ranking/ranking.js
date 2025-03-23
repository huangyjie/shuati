Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    darkMode: false,
    rankType: 'comprehensive', // 修改默认排行类型为综合排行
    timeRange: 'all', // day, week, month, all
    rankingList: [],
    myRanking: null,
    myOpenId: '',
    userInfo: null,
    myStats: null,
    isLogin: false,
    isRefreshing: false,
    showRankDetails: false,
    selectedRank: null
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    const app = getApp();

    this.setData({
      darkMode,
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo
    });

    // 设置导航栏颜色
    this.updateNavigationBarColor();

    this.loadRankingData();
  },

  onShow() {
    // 检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }
    this.loadRankingData();
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

  async loadRankingData() {
    try {
      wx.showLoading({ title: '加载中...' });
      const db = wx.cloud.database();
      const _ = db.command;

      // 根据不同排行类型设置查询条件和获取数据
      if (this.data.rankType === 'comprehensive') {
        // 获取所有用户数据进行综合排名计算
        const [result1, result2] = await Promise.all([
          db.collection('users')
            .where({
              points: _.exists(true)  // 只需要检查积分字段存在即可
            })
            .orderBy('points', 'desc')  // 按积分降序排序
            .limit(100)
            .get(),
          db.collection('users')
            .where({
              points: _.exists(true)
            })
            .orderBy('points', 'desc')
            .skip(100)
            .limit(100)
            .get()
        ]);

        const userList = [...result1.data, ...result2.data];

        // 找出最大值和平均值用于更合理的归一化
        const maxPoints = Math.max(...userList.map(u => u.points || 0));
        const maxQuestions = Math.max(...userList.map(u => u.totalQuestions || 0));
        const avgPoints = userList.reduce((sum, u) => sum + (u.points || 0), 0) / userList.length;
        const avgQuestions = userList.reduce((sum, u) => sum + (u.totalQuestions || 0), 0) / userList.length;

        // 计算综合得分并排序
        let rankingList = userList.map(user => {
          // 计算正确率
          const correctRate = user.totalQuestions > 0 ?
            (user.correctQuestions / user.totalQuestions) * 100 : 0;

          // 计算积分评分（使用分段函数，确保高积分用户获得更高的基础分）
          let pointsScore = 0;
          if (user.points >= 6000) {
            pointsScore = 98 + Math.min(2, (user.points - 6000) / 2000);
          } else if (user.points >= 3000) {
            pointsScore = 90 + (user.points - 3000) / 300;
          } else if (user.points >= 1000) {
            pointsScore = 70 + (user.points - 1000) / 100;
          } else {
            pointsScore = Math.max(40, (user.points / 1000) * 70);
          }

          // 计算刷题量评分（使用分段函数，确保高刷题量用户获得更高的基础分）
          let questionsScore = 0;
          if (user.totalQuestions >= 1000) {
            questionsScore = 95 + Math.min(5, (user.totalQuestions - 1000) / 200);
          } else if (user.totalQuestions >= 500) {
            questionsScore = 85 + (user.totalQuestions - 500) / 33.3;
          } else if (user.totalQuestions >= 200) {
            questionsScore = 70 + (user.totalQuestions - 200) / 20;
          } else {
            questionsScore = Math.max(40, (user.totalQuestions / 200) * 70);
          }

          // 计算正确率评分（非线性计算）
          const accuracyScore = correctRate >= 95 ? 100 :
            correctRate >= 90 ? 95 :
              correctRate >= 85 ? 90 :
                correctRate >= 80 ? 85 :
                  correctRate >= 70 ? 80 :
                    correctRate >= 60 ? 70 :
                      Math.max(40, correctRate * 0.8);

          // 计算综合得分 (总分100分)
          // 直接使用原始数据计算
          const maxPossiblePoints = 6000; // 设定积分上限
          const maxPossibleQuestions = 1000; // 设定刷题数量上限

          // 归一化计算（转换到0-100区间）
          const normalizedPoints = Math.min(100, (user.points || 0) / maxPossiblePoints * 100);
          const normalizedQuestions = Math.min(100, (user.totalQuestions || 0) / maxPossibleQuestions * 100);
          const normalizedAccuracy = correctRate;

          // 综合得分计算（积分50%，刷题数量25%，正确率25%）
          const comprehensiveScore =
            (normalizedPoints * 0.50) +
            (normalizedQuestions * 0.25) +
            (normalizedAccuracy * 0.25);

          // 计算段位
          const tier = this.getRankTier(user.points || 0);

          return {
            ...user,
            comprehensiveScore,
            correctRate: Math.round(correctRate),
            normalizedPoints: Math.round(normalizedPoints),
            normalizedQuestions: Math.round(normalizedQuestions),
            normalizedAccuracy: Math.round(normalizedAccuracy),
            activityBonus: Math.round(this.calculateActivityBonus(user)),
            tier: this.getRankTier(user.points || 0),
            tierClass: this.getTierClass(user.points || 0)
          };
        });

        // 按综合得分排序
        rankingList.sort((a, b) => b.comprehensiveScore - a.comprehensiveScore);

        // 处理排名（包括并列排名）
        let currentRank = 1;
        let currentScore = rankingList[0]?.comprehensiveScore;
        let actualPosition = 1;

        rankingList = rankingList.map((user, index) => {
          if (user.comprehensiveScore < currentScore) {
            currentRank = actualPosition;
            currentScore = user.comprehensiveScore;
          }
          actualPosition++;

          return {
            ...user,
            rank: currentRank,
            nickName: user.nickName || '微信用户',
            avatarUrl: this.getRankAvatar(currentRank),
            tier: this.getRankTier(user.points || 0),
            tierClass: this.getTierClass(user.points || 0),
            comprehensiveScore: Math.round(user.comprehensiveScore * 10) / 10
          };
        });

        // 找到第100名的实际排名（考虑并列）
        const maxRank = Math.min(100, rankingList.length);
        const lastValidRank = rankingList[maxRank - 1]?.rank || 100;
        rankingList = rankingList.filter(item => item.rank <= lastValidRank);

        this.setData({ rankingList });
      } else if (this.data.rankType === 'signIn') {
        // 获取签到天数排行数据
        const [result1, result2] = await Promise.all([
          db.collection('users')
            .where({ signInDays: _.exists(true) })
            .orderBy('signInDays', 'desc')
            .orderBy('consecutiveDays', 'desc')
            .limit(100)
            .get(),
          db.collection('users')
            .where({ signInDays: _.exists(true) })
            .orderBy('signInDays', 'desc')
            .orderBy('consecutiveDays', 'desc')
            .skip(100)
            .limit(100)
            .get()
        ]);

        const signInList = [...result1.data, ...result2.data];

        // 处理排名（包括并列排名）
        let currentRank = 1;
        let currentSignInDays = signInList[0]?.signInDays;
        let currentConsecutiveDays = signInList[0]?.consecutiveDays;
        let actualPosition = 1;

        let rankingList = signInList.map((user, index) => {
          if (user.signInDays < currentSignInDays ||
            (user.signInDays === currentSignInDays && user.consecutiveDays < currentConsecutiveDays)) {
            currentRank = actualPosition;
            currentSignInDays = user.signInDays;
            currentConsecutiveDays = user.consecutiveDays;
          }
          actualPosition++;

          return {
            ...user,
            rank: currentRank,
            nickName: user.nickName || '微信用户',
            avatarUrl: this.getRankAvatar(currentRank),
            signInDays: user.signInDays || 0,
            consecutiveDays: user.consecutiveDays || 0
          };
        });

        // 找到第100名的实际排名（考虑并列）
        const maxRank = Math.min(100, rankingList.length);
        const lastValidRank = rankingList[maxRank - 1]?.rank || 100;
        rankingList = rankingList.filter(item => item.rank <= lastValidRank);

        this.setData({ rankingList });
      } else if (this.data.rankType === 'score') {
        // 获取考试成绩排行数据
        const [result1, result2] = await Promise.all([
          db.collection('mockExams')
            .where({
              score: _.exists(true).and(_.gt(0))
            })
            .orderBy('score', 'desc')
            .limit(100)
            .get(),
          db.collection('mockExams')
            .where({
              score: _.exists(true).and(_.gt(0))
            })
            .orderBy('score', 'desc')
            .skip(100)
            .limit(100)
            .get()
        ]);

        const examList = [...result1.data, ...result2.data];

        if (examList.length === 0) {
          this.setData({ rankingList: [] });
          return;
        }

        // 处理数据，每个用户只保留最高分记录
        const userBestScores = {};
        examList.forEach(exam => {
          const userId = exam.phoneNumber;
          // 计算实际得分（满分150分）
          const actualScore = Math.round((exam.correctCount / exam.answeredCount) * 150);

          if (!userBestScores[userId] || actualScore > userBestScores[userId].score) {
            exam.score = actualScore; // 更新为实际得分
            userBestScores[userId] = exam;
          }
        });

        // 转换为数组并按分数排序
        let rankingList = Object.values(userBestScores)
          .sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            return new Date(a.submitTime).getTime() - new Date(b.submitTime).getTime();
          });

        // 处理排名（包括并列排名）
        let currentRank = 1;
        let currentScore = rankingList[0]?.score;
        let actualPosition = 1;

        rankingList = rankingList.map((exam, index) => {
          if (exam.score < currentScore) {
            currentRank = actualPosition;
            currentScore = exam.score;
          }
          actualPosition++;

          return {
            ...exam,
            rank: currentRank,
            nickName: exam.nickName || '微信用户',
            avatarUrl: this.getRankAvatar(currentRank),
            submitTime: new Date(exam.submitTime).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }),
            score: exam.score, // 使用计算后的实际得分
            correctRate: exam.answeredCount > 0 ?
              Math.round((exam.correctCount / exam.answeredCount) * 100) : 0
          };
        });

        // 找到第100名的实际排名（考虑并列）
        const maxRank = Math.min(100, rankingList.length);
        const lastValidRank = rankingList[maxRank - 1]?.rank || 100;
        rankingList = rankingList.filter(item => item.rank <= lastValidRank);

        console.log('考试排行榜数据：', rankingList);
        this.setData({ rankingList });

      } else if (this.data.rankType === 'quality') {
        // 分两次获取数据，每次100条
        const [result1, result2] = await Promise.all([
          db.collection('users')
            .where({
              totalQuestions: _.exists(true).and(_.gte(100)),
              correctQuestions: _.exists(true)
            })
            .limit(100)
            .get(),
          db.collection('users')
            .where({
              totalQuestions: _.exists(true).and(_.gte(100)),
              correctQuestions: _.exists(true)
            })
            .skip(100)
            .limit(100)
            .get()
        ]);

        const qualityList = [...result1.data, ...result2.data];

        // 计算正确率并排序
        let rankingList = qualityList
          .map(user => ({
            ...user,
            correctRate: user.totalQuestions > 0 ?
              Math.round((user.correctQuestions / user.totalQuestions) * 100) : 0,
            totalQuestions: user.totalQuestions || 0,
            correctQuestions: user.correctQuestions || 0
          }))
          .sort((a, b) => {
            if (b.correctRate !== a.correctRate) {
              return b.correctRate - a.correctRate;
            }
            if (b.totalQuestions !== a.totalQuestions) {
              return b.totalQuestions - a.totalQuestions;
            }
            return b.correctQuestions - a.correctQuestions;
          });

        // 处理排名（包括并列排名）
        let currentRank = 1;
        let currentRate = rankingList[0]?.correctRate;
        let currentTotal = rankingList[0]?.totalQuestions;
        let actualPosition = 1;

        rankingList = rankingList.map((user, index) => {
          if (user.correctRate < currentRate ||
            (user.correctRate === currentRate && user.totalQuestions < currentTotal)) {
            currentRank = actualPosition;
            currentRate = user.correctRate;
            currentTotal = user.totalQuestions;
          }
          actualPosition++;

          return {
            ...user,
            rank: currentRank,
            nickName: user.nickName || '微信用户',
            avatarUrl: this.getRankAvatar(currentRank),
            correctRate: user.totalQuestions > 0 ?
              Math.round((user.correctQuestions / user.totalQuestions) * 100) : 0,
            totalQuestions: user.totalQuestions || 0,
            correctQuestions: user.correctQuestions || 0
          };
        });

        // 找到第100名的实际排名（考虑并列）
        const maxRank = Math.min(100, rankingList.length);
        const lastValidRank = rankingList[maxRank - 1]?.rank || 100;
        rankingList = rankingList.filter(item => item.rank <= lastValidRank);

        this.setData({ rankingList });

      } else if (this.data.rankType === 'points') {
        try {
          // 获取积分排行数据，多获取一些数据以确保有足够的记录显示
          const [result1, result2, result3] = await Promise.all([
            db.collection('users')
              .where({
                points: _.exists(true).and(_.gt(0)),  // 只查询有积分且大于0的用户
                isDeleted: _.neq(true)  // 排除已删除的用户
              })
              .orderBy('points', 'desc')
              .limit(100)
              .get(),
            db.collection('users')
              .where({
                points: _.exists(true).and(_.gt(0)),
                isDeleted: _.neq(true)
              })
              .orderBy('points', 'desc')
              .skip(100)
              .limit(100)
              .get(),
            db.collection('users')
              .where({
                points: _.exists(true).and(_.gt(0)),
                isDeleted: _.neq(true)
              })
              .orderBy('points', 'desc')
              .skip(200)
              .limit(100)
              .get()
          ]);

          console.log('积分排行数据查询结果：', result1, result2, result3);

          if (!result1.data || !result2.data || !result3.data) {
            throw new Error('查询结果数据格式错误');
          }

          const pointsList = [...result1.data, ...result2.data, ...result3.data];

          if (pointsList.length === 0) {
            console.log('没有找到积分数据');
            this.setData({ rankingList: [] });
            return;
          }

          // 处理排名（包括并列排名）
          let currentRank = 1;
          let currentPoints = pointsList[0]?.points || 0;
          let rankingList = [];
          let lastPoints = null;
          let lastRank = 1;

          // 处理排名和数据
          pointsList.forEach((user, index) => {
            const validPoints = Number.isFinite(user.points) ? user.points : 0;
            const validSignInDays = Number.isFinite(user.signInDays) ? user.signInDays : 0;
            const signInPoints = validSignInDays * 5;
            const examPoints = Math.max(0, validPoints - signInPoints);

            // 确定排名
            if (lastPoints === null) {
              lastPoints = validPoints;
              lastRank = 1;
            } else if (validPoints < lastPoints) {
              lastRank = rankingList.length + 1;
              lastPoints = validPoints;
            }

            const userRank = lastRank;

            // 只有排名在前100的才添加到列表中
            if (userRank <= 100) {
              rankingList.push({
                ...user,
                rank: userRank,
                nickName: user.nickName || '微信用户',
                avatarUrl: this.getRankAvatar(userRank),
                tier: this.getRankTier(validPoints),
                points: validPoints,
                signInPoints: signInPoints,
                examPoints: examPoints,
                tierClass: this.getTierClass(validPoints)
              });
            }
          });

          console.log('处理后的排行榜数据：', rankingList);
          this.setData({ rankingList });

        } catch (error) {
          console.error('加载积分排行榜失败：', error);
          wx.showToast({
            title: '加载排行榜失败',
            icon: 'none'
          });
        }
      } else {
        // 刷题数量排行
        const [result1, result2] = await Promise.all([
          db.collection('users')
            .where({ totalQuestions: _.exists(true) })
            .orderBy('totalQuestions', 'desc')
            .limit(100)
            .get(),
          db.collection('users')
            .where({ totalQuestions: _.exists(true) })
            .orderBy('totalQuestions', 'desc')
            .skip(100)
            .limit(100)
            .get()
        ]);

        const countList = [...result1.data, ...result2.data];

        // 处理排名（包括并列排名）
        let currentRank = 1;
        let currentCount = countList[0]?.totalQuestions;
        let actualPosition = 1;

        let rankingList = countList.map((user, index) => {
          if (user.totalQuestions < currentCount) {
            currentRank = actualPosition;
            currentCount = user.totalQuestions;
          }
          actualPosition++;

          return {
            ...user,
            rank: currentRank,
            nickName: user.nickName || '微信用户',
            avatarUrl: this.getRankAvatar(currentRank),
            correctRate: user.totalQuestions > 0 ?
              Math.round((user.correctQuestions / user.totalQuestions) * 100) : 0
          };
        });

        // 找到第100名的实际排名（考虑并列）
        const maxRank = Math.min(100, rankingList.length);
        const lastValidRank = rankingList[maxRank - 1]?.rank || 100;
        rankingList = rankingList.filter(item => item.rank <= lastValidRank);

        this.setData({ rankingList });
      }

    } catch (err) {
      console.error('加载排行榜失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  getRankAvatar(rank) {
    if (rank === 1) return `${this.data.iconBaseUrl}/@1.gif`;
    if (rank === 2) return `${this.data.iconBaseUrl}/@2.png`;
    if (rank === 3) return `${this.data.iconBaseUrl}/@3.png`;
    return `${this.data.iconBaseUrl}/default-avatar.png`;
  },

  // 切换排行榜类型
  changeRankType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      rankType: type,
      timeRange: 'all', // 切换类型时重置时间范围为总榜
      showRankDetails: false
    }, () => {
      this.loadRankingData();
    });
  },

  // 显示排名详情
  showRankDetail(e) {
    const index = e.currentTarget.dataset.index;
    const selectedRank = this.data.rankingList[index];
    this.setData({
      selectedRank,
      showRankDetails: true
    });
  },

  // 关闭排名详情
  closeRankDetail() {
    this.setData({
      showRankDetails: false,
      selectedRank: null
    });
  },

  // 切换时间范围
  changeTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    // 只允许切换到 'day' 或 'all'
    if (range === 'day' || range === 'all') {
      this.setData({ timeRange: range }, () => {
        this.loadRankingData();
      });
    }
  },

  handleLogin() {
    // 先切换到综合页面
    wx.switchTab({
      url: '/pages/comprehensive/comprehensive',
      success: () => {
        console.log('跳转到综合页面成功');
        // 发送一个自定义事件，通知综合页面打开登录弹窗
        const pages = getCurrentPages();
        const comprehensivePage = pages[pages.length - 1];
        if (comprehensivePage && comprehensivePage.handleLogin) {
          setTimeout(() => {
            comprehensivePage.handleLogin();
          }, 500); // 延迟500ms确保页面已完全加载
        }
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加下拉刷新
  onPullDownRefresh() {
    this.refreshRankingData();
  },

  // 优化数据加载方法
  async refreshRankingData() {
    if (this.data.isRefreshing) return;

    try {
      this.setData({ isRefreshing: true });
      await this.loadRankingData();
    } catch (err) {
      console.error('刷新排行榜失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  // 添加获取正确率样式类的方法
  getRateClass(rate) {
    if (rate >= 90) return 'rate-excellent';
    if (rate >= 80) return 'rate-great';
    if (rate >= 70) return 'rate-good';
    if (rate >= 60) return 'rate-normal';
    return 'rate-low';
  },

  // 添加获取正确率等级文字的方法
  getRateLevel(rate) {
    if (rate >= 90) return '优秀';
    if (rate >= 80) return '良好';
    if (rate >= 70) return '中等';
    if (rate >= 60) return '及格';
    return '待提高';
  },

  getRankTier(points) {
    if (points >= 5000) return '至尊';
    if (points >= 3600) return '王者';
    if (points >= 3400) return '大师I';
    if (points >= 3200) return '大师II';
    if (points >= 3000) return '大师III';
    if (points >= 2800) return '钻石I';
    if (points >= 2600) return '钻石II';
    if (points >= 2400) return '钻石III';
    if (points >= 2200) return '铂金I';
    if (points >= 2000) return '铂金II';
    if (points >= 1800) return '铂金III';
    if (points >= 1600) return '黄金I';
    if (points >= 1400) return '黄金II';
    if (points >= 1200) return '黄金III';
    if (points >= 1000) return '白银I';
    if (points >= 800) return '白银II';
    if (points >= 600) return '白银III';
    if (points >= 400) return '青铜I';
    if (points >= 200) return '青铜II';
    return '青铜III';
  },

  getTierClass(points) {
    if (points >= 5000) return 'tier-supreme';
    if (points >= 3600) return 'tier-king';
    if (points >= 3000) return 'tier-master';
    if (points >= 2400) return 'tier-diamond';
    if (points >= 1800) return 'tier-platinum';
    if (points >= 1200) return 'tier-gold';
    if (points >= 600) return 'tier-silver';
    return 'tier-bronze';
  },

  // 计算综合排名段位
  calculateComprehensiveTier(score) {
    if (score >= 95) return '至尊王者';
    if (score >= 90) return '最强王者';
    if (score >= 85) return '荣耀王者';
    if (score >= 80) return '永恒钻石';
    if (score >= 75) return '华贵钻石';
    if (score >= 70) return '璀璨钻石';
    if (score >= 65) return '荣耀铂金';
    if (score >= 60) return '华贵铂金';
    if (score >= 55) return '坚韧铂金';
    if (score >= 50) return '黄金守护';
    if (score >= 45) return '黄金勇者';
    if (score >= 40) return '黄金斗士';
    if (score >= 35) return '白银卫士';
    if (score >= 30) return '白银勇士';
    if (score >= 25) return '白银斗士';
    if (score >= 20) return '青铜卫士';
    if (score >= 15) return '青铜勇士';
    return '青铜斗士';
  },

  // 获取综合排名段位样式类
  getComprehensiveTierClass(score) {
    if (score >= 90) return 'tier-supreme';
    if (score >= 80) return 'tier-king';
    if (score >= 70) return 'tier-diamond';
    if (score >= 60) return 'tier-platinum';
    if (score >= 45) return 'tier-gold';
    if (score >= 30) return 'tier-silver';
    return 'tier-bronze';
  },

  // 阻止事件冒泡
  preventBubble() {
    // 空函数，仅用于阻止事件冒泡
    return;
  },

  calculateActivityBonus(user) {
    // Implementation of calculateActivityBonus method
    // This method should return the calculated activity bonus based on the user's signInDays and consecutiveDays
    // For example, you can use a simple formula to calculate the bonus
    return Math.min(10,
      ((user.signInDays || 0) / 30) * 7 +
      ((user.consecutiveDays || 0) / 7) * 3
    );
  }
}); 