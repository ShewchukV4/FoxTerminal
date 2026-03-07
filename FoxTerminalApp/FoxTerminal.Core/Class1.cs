namespace FoxTerminal.Core;

public sealed class TerminalBuffer
{
    private readonly List<TerminalRow> _scrollback = new();
    private TerminalRow[] _rows;

    public TerminalBuffer(int columns, int rows)
    {
        Columns = Math.Max(1, columns);
        Rows = Math.Max(1, rows);
        _rows = CreateRows(Rows, Columns);
        Cursor = new TerminalCursor();
    }

    public int Columns { get; private set; }
    public int Rows { get; private set; }
    public TerminalCursor Cursor { get; }

    public IReadOnlyList<TerminalRow> VisibleRows => _rows;
    public IReadOnlyList<TerminalRow> Scrollback => _scrollback;

    public void Resize(int columns, int rows)
    {
        columns = Math.Max(1, columns);
        rows = Math.Max(1, rows);

        if (columns == Columns && rows == Rows)
        {
            return;
        }

        var newRows = CreateRows(rows, columns);
        var copyRows = Math.Min(rows, Rows);
        for (var r = 0; r < copyRows; r++)
        {
            newRows[r] = _rows[r].Resize(columns);
        }

        _rows = newRows;
        Columns = columns;
        Rows = rows;
        Cursor.Clamp(Columns, Rows);
    }

    public void Clear()
    {
        _rows = CreateRows(Rows, Columns);
        Cursor.Row = 0;
        Cursor.Column = 0;
    }

    public void ClearLine(int row)
    {
        if (row < 0 || row >= Rows) return;
        _rows[row] = new TerminalRow(Columns);
    }

    public void PutChar(char ch, TerminalStyle style)
    {
        if (ch == '\n')
        {
            NewLine();
            return;
        }

        if (ch == '\r')
        {
            Cursor.Column = 0;
            return;
        }

        if (ch == '\b')
        {
            Cursor.Column = Math.Max(0, Cursor.Column - 1);
            return;
        }

        if (ch == '\t')
        {
            var nextTab = ((Cursor.Column / 4) + 1) * 4;
            Cursor.Column = Math.Min(Columns - 1, nextTab);
            return;
        }

        if (Cursor.Column >= Columns)
        {
            NewLine();
        }

        _rows[Cursor.Row].SetCell(Cursor.Column, new TerminalCell(ch, style));
        Cursor.Column++;
    }

    public void NewLine()
    {
        Cursor.Column = 0;
        Cursor.Row++;
        if (Cursor.Row >= Rows)
        {
            _scrollback.Add(_rows[0]);
            Array.Copy(_rows, 1, _rows, 0, Rows - 1);
            _rows[Rows - 1] = new TerminalRow(Columns);
            Cursor.Row = Rows - 1;
        }
    }

    public void MoveCursor(int rowDelta, int columnDelta)
    {
        Cursor.Row = Math.Clamp(Cursor.Row + rowDelta, 0, Rows - 1);
        Cursor.Column = Math.Clamp(Cursor.Column + columnDelta, 0, Columns - 1);
    }

    public void SetCursor(int row, int column)
    {
        Cursor.Row = Math.Clamp(row, 0, Rows - 1);
        Cursor.Column = Math.Clamp(column, 0, Columns - 1);
    }

    private static TerminalRow[] CreateRows(int rows, int columns)
    {
        var arr = new TerminalRow[rows];
        for (var i = 0; i < rows; i++)
        {
            arr[i] = new TerminalRow(columns);
        }
        return arr;
    }
}

public sealed class TerminalRow
{
    private readonly TerminalCell[] _cells;

    public TerminalRow(int columns)
    {
        _cells = new TerminalCell[columns];
        for (var i = 0; i < _cells.Length; i++)
        {
            _cells[i] = TerminalCell.Empty;
        }
    }

    public IReadOnlyList<TerminalCell> Cells => _cells;

    public void SetCell(int column, TerminalCell cell)
    {
        if (column < 0 || column >= _cells.Length) return;
        _cells[column] = cell;
    }

    public TerminalRow Resize(int columns)
    {
        var row = new TerminalRow(columns);
        var copy = Math.Min(columns, _cells.Length);
        for (var i = 0; i < copy; i++)
        {
            row._cells[i] = _cells[i];
        }
        return row;
    }
}

public sealed class TerminalCursor
{
    public int Row { get; set; }
    public int Column { get; set; }

    public void Clamp(int columns, int rows)
    {
        Row = Math.Clamp(Row, 0, rows - 1);
        Column = Math.Clamp(Column, 0, columns - 1);
    }
}
