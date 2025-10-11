import psycopg2
from psycopg2 import sql

# 資料庫連線設定
db_config = {
    'host': 'iseekbidbstaging.intemotech.com',
    'port': 5404,
    'database': 'postgresdb',
    'user': 'hsintungyang',
    'password': 'G7pL2vX9',
    'sslmode': 'require'
}

try:
    # 建立連線
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    # 查詢所有資料表
    cursor.execute("""
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name;
    """)

    tables = cursor.fetchall()

    print("資料庫中的資料表：")
    print("-" * 50)
    for schema, table in tables:
        print(f"{schema}.{table}")

    cursor.close()
    conn.close()

    print("\n連線成功！")

except Exception as e:
    print(f"連線錯誤：{e}")
