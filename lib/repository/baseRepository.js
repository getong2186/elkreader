const mysql = require('mysql');
const Q = require('q');
const async = require('async');
const config = require('../../config').mysql;

const pool = generationPool(config);

exports.pool = pool;

(function (mysqlDao) {

  mysqlDao.query = function (sql, values) {
    const d = Q.defer();
    //监听connection事件
    pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        if (connection) {
          connection.destory();
        }
        return d.reject(error);
      }

      //未连接
      if (!connection) {
        return d.reject(error);
      }
      //
      const sqls = { sql, values, timeout: 40000 };

      try {
        connection.query(sqls, function (error, rows) {
          if (error) {
            console.log(error);
            connection.destroy();
            return d.reject(error);
          }

          connection.release();
          return d.resolve(rows);
        });
      } catch (err) {
        throw new Error(err);
      }

    });
    return d.promise;
  };

  /**
 *  mysql事物操作函数
 *  @param   tasks     {Array}   sql语句数组  例如：[{sql :'INSERT INTO users(name,age) VALUES(?,?)','values':['lili',22]}]
 *   --@param   sql    {String}  sql语句使用占位符， 可以防止sql注入
 *   --@param   vaues  {Array}   sql语句占位符对应位置的值;
 */
  mysqlDao.transaction = function (sqls) {
    const d = Q.defer();

    // 监听connection事件
    pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        if (connection) {
          connection.destroy();
        }
        return d.reject(error);
      }
      // no connection
      if (!connection) {
        return d.reject(new Error('connection is null'));
      }

      connection.beginTransaction(function (error) {
        if (error) {
          connection.destroy();
          return d.reject(error);
        }

        const taskArray = generationTaskFunArray(connection, sqls);
        async.series(taskArray, function (error, result) {
          if (error) {
            // 回滚
            connection.rollback(function () {
              connection.destroy(); // 释放资源
              return d.reject(error);
            });
          }
          // 提交
          connection.commit(function (error) {
            if (error) {
              connection.destroy();
              return d.reject(error);
            }
            connection.release();
            return d.resolve(1);
          });
        });
      });
    });
    return d.promise;
  };

}(exports));

/**
 * @param  config  <Object>  数据库的配置
 * @return mysql连接池
 */
function generationPool (config) {
  let dbHost = config.dbHost;
  let pool = dbHost.length === 1 ? poolFun(config) : poolClusterFun(config);
  return pool;
};
/**
 * 生成连接池
 * @param  config  <Object>  数据库的配置
 * @return mysql连接池
 */
function poolFun (config) {
  let cfg = {
    host: config.dbHost[0],
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    connectionLimit: 50
  };
  // 创建连接池
  var p = mysql.createPool(cfg);
  return p;
}
/**
* 生成连接池集群
* @param  config  <Object>  数据库的配置
* @return mysql连接池集群
*/
function poolClusterFun (config) {
  var poolCluster = mysql.createPoolCluster();
  for (let index = 0; index < config.dbHost.length; index++) {
    let cfg = {
      host: config.dbHost[index],
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      connectionLimit: 50
    };
    poolCluster.add(cfg);
  }
  return poolCluster;
}

/**
* async.series的 流程函数 组成的数组的生成函数
* @param   connection  {Object}   mysql连接对象
* @param   tasks       {Array}    sql语句数组
* @return  array       {Array}    async.series的 流程函数 组成的数组
*/
function generationTaskFunArray (connection, tasks) {
  let array = [];
  for (let i = 0; i < tasks.length; i++) {
    let o = tasks[i];
    let sql = o.sql;
    let values = o.values;
    let t = function (callback) {
      connection.query(sql, values, function (error, result) {
        if (error) {
          return callback(error, null);
        }
        return callback(null, result);
      });
    };
    array.push(t);
  }
  return array;
};

